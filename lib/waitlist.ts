import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {Temporal} from '@js-temporal/polyfill';
import type {PoolClient} from 'pg';
import {db} from './db';
import {BookingError,createBooking,dateBounds,localInstant,slots,todayNZ,windowFor,ZONE} from './booking';
import {publicShop} from './guest';
import {requiresDeposit} from './deposit-settings';

type Query=Pick<PoolClient,'query'>;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length<=max?v.trim():'';
function tokenHash(v:unknown){if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw new BookingError('This waitlist link is invalid.');return hash(v)}
const wall=(date:Date)=>Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(ZONE);
const localTime=(z:Temporal.ZonedDateTime)=>`${String(z.hour).padStart(2,'0')}:${String(z.minute).padStart(2,'0')}`;

export async function joinWaitlist(data:Record<string,unknown>){
 const shop=await publicShop(text(data.slug,80));if(!shop||!shop.booking_published)throw new BookingError('Shop not found.');
 const service=text(data.serviceId,100),barber=text(data.barberId,100),first=text(data.firstName,100),email=text(data.email,254).toLowerCase(),phone=text(data.phone,40),from=text(data.dateFrom,10),to=text(data.dateTo,10),timeFrom=text(data.timeFrom,5),timeTo=text(data.timeTo,5),days=data.weekdays;
 if(!first||!/^\S+@\S+\.\S+$/.test(email)||!service||!Array.isArray(days)||!days.length||days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(days).size!==days.length)throw new BookingError('Please check your name, email, service and preferred days.');
 try{dateBounds(from);dateBounds(to);localInstant(from,timeFrom);localInstant(from,timeTo);if(from<todayNZ()||to<from||Temporal.PlainDate.compare(Temporal.PlainDate.from(to),Temporal.PlainDate.from(from).add({years:1}))>0||timeTo<=timeFrom)throw Error()}catch{throw new BookingError('Choose a valid date range within one year and an end time after the start time.');}
 const assigned=await db.query('SELECT 1 FROM barber_services WHERE shop_id=$1 AND service_id=$2 AND ($3=$4 OR barber_id=$3) LIMIT 1',[shop.id,service,barber,'any']);if(!assigned.rowCount)throw new BookingError('That barber or service is no longer available.');
 const token=randomBytes(32).toString('hex');
 await db.query(`INSERT INTO waitlist_entries(id,shop_id,service_id,preferred_barber_id,first_name,email,phone,date_from,date_to,weekdays,time_from,time_to,token_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[randomUUID(),shop.id,service,barber==='any'?null:barber,first,email,phone,from,to,days,timeFrom,timeTo,hash(token)]);
 return {token};
}

// Openings are durable: a failed check can safely be retried from the worker or status page.
export async function processOpenings(shopId:string){
 await db.query("UPDATE waitlist_offers SET state='expired' WHERE shop_id=$1 AND state='offered' AND expires_at<=clock_timestamp()",[shopId]);
 const openings=(await db.query('SELECT * FROM waitlist_openings WHERE shop_id=$1 AND processed_at IS NULL ORDER BY created_at LIMIT 50',[shopId])).rows;
 for(const opening of openings){
  const z=wall(opening.starts_at),date=z.toPlainDate().toString(),day=z.dayOfWeek%7;
  if(opening.ends_at.getTime()>Date.now()){
   const candidates=(await db.query(`SELECT w.*,w.date_from::text,w.date_to::text,w.time_from::text,w.time_to::text,s.duration,coalesce(bp.price_cents,s.price_cents) AS price_cents,coalesce(d.enabled,false) AS deposit_enabled FROM waitlist_entries w JOIN services s ON s.shop_id=w.shop_id AND s.id=w.service_id JOIN barber_services bs ON bs.shop_id=w.shop_id AND bs.service_id=w.service_id AND bs.barber_id=$2 LEFT JOIN barber_service_prices bp ON bp.shop_id=bs.shop_id AND bp.barber_id=bs.barber_id AND bp.service_id=bs.service_id LEFT JOIN service_deposits d ON d.shop_id=s.shop_id AND d.service_id=s.id WHERE w.shop_id=$1 AND w.status='waiting' AND (w.preferred_barber_id IS NULL OR w.preferred_barber_id=$2) AND w.date_from<=$3::date AND w.date_to>=$3::date AND $4=ANY(w.weekdays) AND NOT EXISTS(SELECT 1 FROM waitlist_offers o WHERE o.waitlist_id=w.id AND o.state IN ('offered','payment_pending')) ORDER BY w.created_at,w.id`,[shopId,opening.barber_id,date,day])).rows;
   for(const w of candidates){
    let times:string[]=[],notice=0;try{const window=await windowFor({shopId,barberId:opening.barber_id,serviceId:w.service_id,date});if(window){notice=window.minimumNotice;times=await slots({shopId,barberId:opening.barber_id,serviceId:w.service_id,date,audience:'guest'})}}catch(e){if(!(e instanceof BookingError))throw e}
    const cutoff=Math.max(1,notice,w.deposit_enabled?36:0);
    const time=times.find(t=>{const start=localInstant(date,t).epochMilliseconds,end=start+Number(w.duration)*60000;const timeEnd=localTime(wall(new Date(end)));return start>=opening.starts_at.getTime()&&end<=opening.ends_at.getTime()&&t>=w.time_from.slice(0,5)&&timeEnd<=w.time_to.slice(0,5)&&start>Date.now()+Math.max(5,cutoff+1)*60000});
    if(!time)continue;const start=localInstant(date,time).epochMilliseconds,expiry=Math.min(Date.now()+30*60000,start-cutoff*60000);
    await db.query(`INSERT INTO waitlist_offers(id,shop_id,waitlist_id,opening_id,barber_id,starts_at,ends_at,price_cents,duration_minutes,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,[randomUUID(),shopId,w.id,opening.id,opening.barber_id,new Date(start),new Date(start+Number(w.duration)*60000),w.price_cents,w.duration,new Date(expiry)]);
   }
  }
  await db.query('UPDATE waitlist_openings SET processed_at=now() WHERE id=$1 AND shop_id=$2',[opening.id,shopId]);
 }
}

async function lookup(token:unknown,q:Query=db,lock=false){const result=await q.query(`SELECT w.*,s.name AS shop_name,s.location,s.accent,s.public_slug,s.booking_published,v.name AS service_name,v.duration,v.price_cents,coalesce(d.enabled,false) AS deposit_enabled FROM waitlist_entries w JOIN shops s ON s.id=w.shop_id JOIN services v ON v.id=w.service_id AND v.shop_id=w.shop_id LEFT JOIN service_deposits d ON d.shop_id=w.shop_id AND d.service_id=w.service_id WHERE w.token_hash=$1${lock?' FOR UPDATE OF w':''}`,[tokenHash(token)]);if(!result.rowCount)throw new BookingError('This waitlist link is invalid.');return result.rows[0];}
export async function waitlistShopId(token:unknown){return (await lookup(token)).shop_id as string}
export async function waitlistStatus(token:unknown){
 let w=await lookup(token);await processOpenings(w.shop_id);w=await lookup(token);
 const offer=(await db.query(`SELECT o.id,o.state,o.starts_at,o.ends_at,o.expires_at,o.price_cents,o.duration_minutes,o.barber_id,b.name AS barber_name FROM waitlist_offers o JOIN barbers b ON b.id=o.barber_id AND b.shop_id=o.shop_id WHERE o.waitlist_id=$1 AND o.shop_id=$2 ORDER BY o.created_at DESC LIMIT 1`,[w.id,w.shop_id])).rows[0]||null;
 return {shop:{name:w.shop_name,location:w.location,accent:w.accent,slug:w.public_slug},status:w.status,firstName:w.first_name,email:w.email,phone:w.phone,serviceId:w.service_id,serviceName:w.service_name,depositEnabled:w.deposit_enabled,offer};
}
export async function declineOffer(token:unknown,offerId:unknown){const w=await lookup(token);const result=await db.query("UPDATE waitlist_offers SET state='declined' WHERE id=$1 AND waitlist_id=$2 AND shop_id=$3 AND state='offered' AND expires_at>clock_timestamp() RETURNING id",[offerId,w.id,w.shop_id]);if(!result.rowCount)throw new BookingError('That offer has expired or is no longer available.');return {ok:true};}
export async function leaveWaitlist(token:unknown){const q=await db.connect();try{await q.query('BEGIN');const w=await lookup(token,q,true);if(w.status!=='waiting')throw new BookingError('This waitlist entry is no longer waiting.');if((await q.query("SELECT 1 FROM waitlist_offers WHERE waitlist_id=$1 AND state='payment_pending'",[w.id])).rowCount)throw new BookingError('Finish or cancel the pending test payment first.');await q.query("UPDATE waitlist_entries SET status='left' WHERE id=$1",[w.id]);await q.query("UPDATE waitlist_offers SET state='declined' WHERE waitlist_id=$1 AND state='offered'",[w.id]);await q.query('COMMIT');return {ok:true}}catch(e){await q.query('ROLLBACK');throw e}finally{q.release()}}
// Called while holding the shop lock, both for immediate claims and deposit holds.
export async function checkOffer(q:Query,shopId:string,token:unknown,offerId:unknown){
 const w=await lookup(token,q,true);if(w.shop_id!==shopId||w.status!=='waiting'||!w.booking_published)throw new BookingError('This waitlist offer is no longer available.');
 const o=(await q.query("SELECT * FROM waitlist_offers WHERE id=$1 AND waitlist_id=$2 AND shop_id=$3 FOR UPDATE",[offerId,w.id,shopId])).rows[0];
 if(!o||o.state!=='offered'||o.expires_at.getTime()<=Date.now()||o.starts_at.getTime()<=Date.now())throw new BookingError('This waitlist offer has expired or is no longer available.');
 const price=(await q.query('SELECT coalesce(p.price_cents,s.price_cents) AS price FROM services s JOIN barber_services bs ON bs.shop_id=s.shop_id AND bs.service_id=s.id AND bs.barber_id=$3 LEFT JOIN barber_service_prices p ON p.shop_id=bs.shop_id AND p.barber_id=bs.barber_id AND p.service_id=bs.service_id WHERE s.shop_id=$1 AND s.id=$2',[shopId,w.service_id,o.barber_id])).rows[0];if(!price||o.price_cents!==price.price||o.duration_minutes!==w.duration)throw new BookingError('The service details changed. This offer is no longer available.');
 return {w,o};
}
export async function claimOffer(token:unknown,offerId:unknown){
 const initial=await lookup(token),q=await db.connect();
 try{await q.query('BEGIN');await q.query('SELECT id FROM shops WHERE id=$1 FOR UPDATE',[initial.shop_id]);const {w,o}=await checkOffer(q,initial.shop_id,token,offerId);if(await requiresDeposit(w.shop_id,[w.service_id],q))throw new BookingError('A deposit is required. Continue to the secure test payment flow.');
 const z=wall(o.starts_at),booking=await createBooking(w.shop_id,{serviceId:w.service_id,barberId:o.barber_id,date:z.toPlainDate().toString(),time:localTime(z),customer:w.first_name,phone:w.phone},q,{tokenHash:tokenHash(token),email:w.email,expectedPrice:o.price_cents});
 await q.query("UPDATE waitlist_offers SET state='claimed',booking_entry_id=$1 WHERE id=$2",[booking.id,o.id]);await q.query("UPDATE waitlist_entries SET status='booked' WHERE id=$1",[w.id]);await q.query('COMMIT');return {ok:true};
 }catch(e){await q.query('ROLLBACK');if(e instanceof BookingError&&/not available|no longer available|changed/i.test(e.message))await db.query("UPDATE waitlist_offers SET state='unavailable' WHERE id=$1 AND waitlist_id=$2 AND state='offered' AND expires_at>clock_timestamp()",[offerId,initial.id]);throw e}finally{q.release()}
}
