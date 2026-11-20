import {Temporal} from '@js-temporal/polyfill';
import {randomUUID} from 'node:crypto';
import {db} from './db';
import {BookingError,createBooking,localInstant,slots,todayNZ} from './booking';

function input(data:Record<string,unknown>){
 const date=String(data.date||''),end=String(data.repeatEnd||''),time=String(data.time||''),interval=Number(data.repeatWeeks);
 let start:Temporal.PlainDate,finish:Temporal.PlainDate;
 try{start=Temporal.PlainDate.from(date);finish=Temporal.PlainDate.from(end);if(start.toString()!==date||finish.toString()!==end||date<todayNZ()||Temporal.PlainDate.compare(finish,start)<0||Temporal.PlainDate.compare(finish,start.add({years:1}))>0||!localInstant(date,time))throw Error()}catch{throw new BookingError('Choose a valid future start and an end date within one year.');}
 if(![1,2,4,6,8].includes(interval)||!data.barberId||!data.serviceId)throw new BookingError('Choose a barber, service and repeat interval.');
 const dates:string[]=[];for(let d=start;Temporal.PlainDate.compare(d,finish)<=0;d=d.add({weeks:interval})){dates.push(d.toString());if(dates.length>53)throw new BookingError('A repeat series can have up to 53 visits.');}
 return {date,end,time,interval,dates,barberId:String(data.barberId),serviceId:String(data.serviceId)};
}
export async function previewRecurring(shopId:string,data:Record<string,unknown>){
 const p=input(data),results:{date:string;available:boolean}[]=[];
 for(const date of p.dates){let available=false;try{available=localInstant(date,p.time).epochMilliseconds>Date.now()&&(await slots({shopId,barberId:p.barberId,serviceId:p.serviceId,date})).includes(p.time)}catch(e){if(!(e instanceof BookingError))throw e}results.push({date,available});}
 return {dates:results};
}
export async function createRecurring(shopId:string,data:Record<string,unknown>){
 const p=input(data),expected=data.expectedDates;
 if(!Array.isArray(expected)||!expected.length||expected.some(d=>typeof d!=='string')||new Set(expected).size!==expected.length)throw new BookingError('Preview the repeat dates before saving.');
 const preview=await previewRecurring(shopId,data),available=preview.dates.filter(d=>d.available).map(d=>d.date);
 if(JSON.stringify(expected)!==JSON.stringify(available))throw new BookingError('Availability changed. Preview the dates again; no repeat bookings were made.');
 const q=await db.connect(),seriesId=randomUUID();
 try{await q.query('BEGIN');await q.query('SELECT id FROM shops WHERE id=$1 FOR UPDATE',[shopId]);await q.query('INSERT INTO recurring_series(id,shop_id,barber_id,service_id,interval_weeks,start_date,end_date) VALUES($1,$2,$3,$4,$5,$6,$7)',[seriesId,shopId,p.barberId,p.serviceId,p.interval,p.date,p.end]);
 let clientId=typeof data.clientId==='string'?data.clientId:'';
 for(const date of available){if(localInstant(date,p.time).epochMilliseconds<=Date.now())throw new BookingError('A repeat date has passed.');const entry=await createBooking(shopId,{...data,date,clientId},q);await q.query('UPDATE schedule_entries SET recurrence_id=$1 WHERE id=$2 AND shop_id=$3',[seriesId,entry.id,shopId]);if(!clientId)clientId=(await q.query('SELECT client_id FROM schedule_entries WHERE id=$1 AND shop_id=$2',[entry.id,shopId])).rows[0].client_id;}
 await q.query('COMMIT');return {created:available,skipped:preview.dates.filter(d=>!d.available).map(d=>d.date)};
 }catch(e){await q.query('ROLLBACK');if(e instanceof BookingError||typeof e==='object'&&e!==null&&'code'in e&&(e as {code:string}).code==='23P01')throw new BookingError('A repeat date became unavailable. No repeat bookings were made; preview again.');throw e}finally{q.release()}
}
