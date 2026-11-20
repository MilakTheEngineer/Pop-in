import {Temporal} from '@js-temporal/polyfill';
import bcrypt from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import {db} from '../lib/db';
import {createBlock,createBooking,localInstant,setStatus} from '../lib/booking';

// Run only against the explicitly isolated local QA database.
const url=new URL(process.env.DATABASE_URL||'postgresql://invalid');
if(url.hostname!=='127.0.0.1'||url.port!=='56441'||process.env.POPIN_ENVIRONMENT!=='local')throw Error('QA fixtures require the isolated local database on port 56441.');
const shop='qa-rimu',other='qa-other',password=process.env.DEMO_PASSWORD;if(!password)throw Error('The test password is missing.');
const now=Temporal.Now.plainDateISO('Pacific/Auckland'),nextSat=now.add({days:((6-now.dayOfWeek+7)%7)||7}),priorSat=now.subtract({days:((now.dayOfWeek-6+7)%7)||7}),today=now.toString();
if((await db.query('SELECT 1 FROM shops WHERE id=$1',[shop])).rowCount)throw Error('The QA fixture already exists; preserve it instead of replacing it.');
await db.query("INSERT INTO shops(id,name,location,public_slug,booking_published,photo,photo_type) SELECT $1,'Rimu Barbers QA','Rotorua',$1,true,photo,photo_type FROM shops WHERE id='rimu'",[shop]);
await db.query("INSERT INTO shops(id,name,location,public_slug,booking_published) VALUES($1,'Other QA Shop','Rotorua',$1,true)",[other]);
const pass=await bcrypt.hash(password,10);
for(const [id,email,name] of [['qa-owner','qa-owner@example.test','Ari Owner'],['qa-staff','qa-staff@example.test','Jordan Staff'],['qa-operator','qa-operator@example.test','QA Operator'],['qa-other-owner','qa-other-owner@example.test','Other Owner']])await db.query('INSERT INTO staff(id,email,password_hash,name) VALUES($1,$2,$3,$4)',[id,email,pass,name]);
await db.query("INSERT INTO memberships VALUES('qa-owner',$1),('qa-staff',$1),('qa-other-owner',$2)",[shop,other]);await db.query("INSERT INTO shop_owners VALUES('qa-owner',$1),('qa-other-owner',$2)",[shop,other]);
await db.query("INSERT INTO services(id,shop_id,name,description,price_cents,duration) VALUES('qa-standard',$1,'Standard cut','Classic cut and tidy.',4500,30),('qa-kids',$1,'Kids cut','Aged 12 and under.',3500,20)",[shop]);
for(const [id,name] of [['qa-ari','Ari'],['qa-jordan','Jordan']]){await db.query('INSERT INTO barbers(id,shop_id,name) VALUES($1,$2,$3)',[id,shop,name]);for(const service of ['qa-standard','qa-kids'])await db.query('INSERT INTO barber_services VALUES($1,$2,$3)',[shop,id,service]);for(let day=0;day<7;day++)await db.query("INSERT INTO shifts VALUES($1,$2,$3,false,'09:00','17:00')",[shop,id,day])}
for(let day=0;day<7;day++)await db.query("INSERT INTO shop_hours VALUES($1,$2,false,'09:00','17:00')",[shop,day]);
await db.query("INSERT INTO directory_profiles(shop_id,opted_in,description,referral_secret) VALUES($1,true,'Fictional shop for local QA.',$2)",[shop,randomBytes(32).toString('hex')]);
await db.query("INSERT INTO reminder_settings(shop_id,enabled,channel,lead_minutes) VALUES($1,true,'email',2880)",[shop]);
for(const day of [...new Set([today,nextSat.toString()])]){
 await createBooking(shop,{barberId:'qa-ari',serviceId:'qa-standard',date:day,time:'10:15',customer:'Tāne Sample'});
 await createBooking(shop,{barberId:'qa-jordan',serviceId:'qa-kids',date:day,time:'11:00',customer:'Mia Sample'});
 await createBooking(shop,{barberId:'qa-jordan',serviceId:'qa-standard',date:day,time:'12:00',customer:'Mere Sample'});
 await createBlock(shop,{barberId:'qa-ari',date:day,time:'13:00',endTime:'13:30',label:'Lunch'});
}
const reportDay=priorSat.toString();
const paid=await createBooking(shop,{barberId:'qa-ari',serviceId:'qa-standard',date:reportDay,time:'09:00',customer:'Paid Sample'});
const owed=await createBooking(shop,{barberId:'qa-jordan',serviceId:'qa-kids',date:reportDay,time:'09:30',customer:'Unpaid Sample',source:'walk_in'});
const cancelled=await createBooking(shop,{barberId:'qa-ari',serviceId:'qa-standard',date:reportDay,time:'10:00',customer:'Cancelled Sample'});
await setStatus(shop,{id:paid.id,status:'completed'});await setStatus(shop,{id:owed.id,status:'completed'});await setStatus(shop,{id:cancelled.id,status:'cancelled'});
await db.query("INSERT INTO shop_payment_tracking(shop_id,start_date,enabled_by) VALUES($1,'2020-01-01','qa-owner')",[shop]);await db.query("INSERT INTO payment_entries(id,shop_id,entry_id,kind,amount_cents,tender,occurred_at,recorded_by) VALUES('qa-payment',$1,$2,'payment',4500,'card',$3,'qa-owner')",[shop,paid.id,localInstant(reportDay,'09:30').toString()]);
console.log(JSON.stringify({shop,other,upcomingSaturday:nextSat.toString(),reportSaturday:reportDay,reportExpected:{completed:2,collectedNZD:45,unpaidNZD:35,bookedValueNZD:80},timelineSample:'Ari 10:15–10:45; Jordan 11:00–11:20; Ari lunch 13:00–13:30',synthetic:true}));await db.end();
