import {randomUUID} from 'node:crypto';
import {Temporal} from '@js-temporal/polyfill';
import {db} from './db';
import {BookingError,localInstant,resource,ZONE} from './booking';

function text(v:unknown,max:number){return typeof v==='string'&&v.trim().length<=max?v.trim():''}
function interval(d:Record<string,unknown>){
 const startDate=text(d.startDate,10),endDate=text(d.endDate,10);
 try{
  const a=Temporal.PlainDate.from(startDate),b=Temporal.PlainDate.from(endDate);
  if(a.toString()!==startDate||b.toString()!==endDate||Temporal.PlainDate.compare(a,b)>0||a.until(b).days>365)throw Error();
  const start=d.allDay===true?a.toZonedDateTime(ZONE).toInstant():localInstant(startDate,text(d.startTime,5));
  const end=d.allDay===true?b.add({days:1}).toZonedDateTime(ZONE).toInstant():localInstant(endDate,text(d.endTime,5));
  if(Temporal.Instant.compare(start,end)>=0)throw Error();
  return {start:start.toString(),end:end.toString()};
 }catch{throw new BookingError('Choose a valid start and finish within one year.');}
}
export async function timeOffView(shop:string,user:string,owner:boolean){
 const [barbers,accounts,link,records]=await Promise.all([
  db.query('SELECT id,name FROM barbers WHERE shop_id=$1 ORDER BY name',[shop]),
  owner?db.query('SELECT s.id,s.name,s.email,l.barber_id FROM memberships m JOIN staff s ON s.id=m.staff_id LEFT JOIN staff_barber_links l ON l.shop_id=m.shop_id AND l.staff_id=m.staff_id WHERE m.shop_id=$1 ORDER BY s.name',[shop]):Promise.resolve({rows:[]}),
  db.query('SELECT barber_id FROM staff_barber_links WHERE shop_id=$1 AND staff_id=$2',[shop,user]),
  db.query(`SELECT t.id,t.barber_id,b.name,t.starts_at,t.ends_at,t.reason,t.status,t.requested_by FROM staff_time_off t JOIN barbers b ON b.shop_id=t.shop_id AND b.id=t.barber_id WHERE t.shop_id=$1 AND ($3::boolean OR t.requested_by=$2 OR (t.requested_by IS NULL AND EXISTS (SELECT 1 FROM staff_barber_links l WHERE l.shop_id=t.shop_id AND l.barber_id=t.barber_id AND l.staff_id=$2))) ORDER BY t.created_at DESC LIMIT 200`,[shop,user,owner])
 ]);
 return {barbers:barbers.rows,accounts:accounts.rows,linkedBarber:link.rows[0]?.barber_id||null,records:records.rows};
}
export class TimeOffConflict extends Error {constructor(public appointments:unknown[]){super('Move or cancel these appointments before confirming time off.')}}
export async function timeOffAction(shop:string,user:string,owner:boolean,d:Record<string,unknown>){
 const action=text(d.action,30),q=await db.connect();
 try{
  await q.query('BEGIN');
  if(action==='link'){
   if(!owner)throw new BookingError('Only the owner can link staff accounts.');
   const staff=text(d.staffId,100),barber=text(d.barberId,100);
   if(!(await q.query('SELECT 1 FROM memberships WHERE shop_id=$1 AND staff_id=$2',[shop,staff])).rowCount)throw new BookingError('Choose a staff account in this shop.');
   if(barber&&!(await q.query('SELECT 1 FROM barbers WHERE shop_id=$1 AND id=$2',[shop,barber])).rowCount)throw new BookingError('Choose a barber in this shop.');
   await q.query('DELETE FROM staff_barber_links WHERE shop_id=$1 AND staff_id=$2',[shop,staff]);
   if(barber)await q.query('INSERT INTO staff_barber_links(shop_id,staff_id,barber_id) VALUES($1,$2,$3)',[shop,staff,barber]);
  }else if(action==='request'||action==='save'||action==='approve'||action==='decline'||action==='cancel'){
   const id=text(d.id,100),existing=id?(await q.query('SELECT * FROM staff_time_off WHERE id=$1 AND shop_id=$2 FOR UPDATE',[id,shop])).rows[0]:null;
   if(id&&!existing)throw new BookingError('Time off not found.');
   if(action==='request'&&id)throw new BookingError('Submit a new request instead.');
   if(!owner&&action!=='request'&&!(action==='cancel'&&existing?.requested_by===user&&existing.status==='pending'))throw new BookingError('Only the owner can make this change.');
   if(['approve','decline'].includes(action)&&(!existing||existing.status!=='pending'))throw new BookingError('This request has already been decided.');
   if(action==='cancel'){
    if(!existing||existing.status==='cancelled')throw new BookingError('This time off is no longer active.');
    if(existing.block_id)await q.query("UPDATE schedule_entries SET status='cancelled' WHERE id=$1 AND shop_id=$2 AND status='blocked'",[existing.block_id,shop]);
    await q.query("UPDATE staff_time_off SET status='cancelled',block_id=NULL WHERE id=$1",[id]);
   }else if(action==='decline')await q.query("UPDATE staff_time_off SET status='declined' WHERE id=$1",[id]);
   else{
    let barber:string,range:{start:string;end:string},reason:string;
    if(action==='approve'){barber=existing.barber_id;range={start:existing.starts_at.toISOString(),end:existing.ends_at.toISOString()};reason=existing.reason;}
    else {barber=owner&&action==='save'?text(d.barberId,100):(await q.query('SELECT barber_id FROM staff_barber_links WHERE shop_id=$1 AND staff_id=$2',[shop,user])).rows[0]?.barber_id;if(!barber)throw new BookingError('Ask the owner to link your staff account to your barber profile.');range=interval(d);reason=text(d.reason,500);}
    if(!(await q.query('SELECT 1 FROM barbers WHERE shop_id=$1 AND id=$2',[shop,barber])).rowCount)throw new BookingError('Choose a barber in this shop.');
    const approve=action==='approve'||action==='save';
    if(existing&&action==='save'&&existing.status!=='approved')throw new BookingError('Only approved time off can be edited.');
    let block:string|null=null;
    if(approve){
     const conflicts=(await q.query(`SELECT DISTINCT CASE WHEN e.shop_id=$1 THEN e.id ELSE '' END AS id,CASE WHEN e.shop_id=$1 THEN e.customer_name ELSE 'Appointment at another location' END AS customer_name,e.starts_at,e.ends_at FROM schedule_capacity c JOIN barbers b ON b.shop_id=c.shop_id AND b.id=c.barber_id JOIN barbers target ON target.person_id=b.person_id AND target.shop_id=$1 AND target.id=$2 JOIN schedule_entries e ON e.id=c.entry_id WHERE c.active AND c.starts_at<$4 AND c.ends_at>$3 AND e.kind='appointment' AND e.status='booked' ORDER BY e.starts_at`,[shop,barber,range.start,range.end])).rows;
     if(conflicts.length)throw new TimeOffConflict(conflicts);
     if(existing?.block_id)await q.query("UPDATE schedule_entries SET status='cancelled' WHERE id=$1 AND shop_id=$2 AND status='blocked'",[existing.block_id,shop]);
     const key=await resource(shop,barber,q);block=randomUUID();
     await q.query("INSERT INTO schedule_entries(id,shop_id,barber_id,resource_key,kind,status,label,starts_at,ends_at) VALUES($1,$2,$3,$4,'block','blocked','Unavailable',$5,$6)",[block,shop,barber,key,range.start,range.end]);
    }
    if(existing)await q.query("UPDATE staff_time_off SET barber_id=$2,starts_at=$3,ends_at=$4,reason=$5,status=$6,block_id=$7 WHERE id=$1",[id,barber,range.start,range.end,reason,approve?'approved':'pending',block]);
    else await q.query('INSERT INTO staff_time_off(id,shop_id,barber_id,requested_by,starts_at,ends_at,reason,status,block_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[randomUUID(),shop,barber,action==='request'?user:null,range.start,range.end,reason,approve?'approved':'pending',block]);
   }
  }else throw new BookingError('Invalid action.');
  await q.query('COMMIT');return {ok:true};
 }catch(e){await q.query('ROLLBACK');if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='23P01')throw new BookingError('This time overlaps another booking or unavailable period. Refresh and review the calendar.');if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='23505')throw new BookingError('That barber is already linked to another account.');throw e}finally{q.release()}
}
