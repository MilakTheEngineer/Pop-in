import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {db} from './db';

type Email={to:string;subject:string;text:string};
type Query=Pick<PoolClient,'query'>;
export type BookingEmailProvider={send:(message:Email,key:string)=>Promise<{id:string}>};

export function bookingEmailTestEnabled(){try{const url=new URL(process.env.DATABASE_URL||'postgresql://invalid');return process.env.POPIN_BOOKING_EMAIL_TEST==='true'&&process.env.NODE_ENV!=='production'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)}catch{return false}}
export function bookingEmailEnabled(){return bookingEmailTestEnabled()||process.env.POPIN_BOOKING_EMAIL_ENABLED==='true'}
// A production pilot must explicitly name its test inboxes. An empty list sends nothing.
function permittedRecipient(address:string){return bookingEmailTestEnabled()||Boolean(address&&process.env.POPIN_BOOKING_EMAIL_ALLOWED_RECIPIENTS?.split(',').some(value=>value.trim().toLowerCase()===address.trim().toLowerCase()))}
function key(){const value=(bookingEmailTestEnabled()?process.env.POPIN_BOOKING_EMAIL_TEST_KEY:process.env.POPIN_BOOKING_EMAIL_KEY)||'',bytes=Buffer.from(value,'base64');if(bytes.length!==32||bytes.toString('base64')!==value)throw Error('A 32-byte base64 booking email encryption key is required.');return bytes}
function encrypt(value:Email){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv),payload=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),payload]).toString('base64')}
function decrypt(value:string):Email{const data=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',key(),data.subarray(0,12));cipher.setAuthTag(data.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8')) as Email}

export async function enqueueBookingEmail(q:Query,data:{shopId:string;subjectType:'booking'|'visit';subjectId:string;event:'confirmation'|'change'|'cancellation'|'reminder';eventKey:string;email:Email}){
 if(!bookingEmailEnabled())return;
 if(bookingEmailTestEnabled()&&!/^[^\s@]+@example\.test$/i.test(data.email.to))throw Error('Booking email tests require a fictional @example.test address.');
 if(!permittedRecipient(data.email.to))return;
 await q.query('INSERT INTO booking_email_outbox(id,shop_id,subject_type,subject_id,event,event_key,payload_ciphertext) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(event_key) DO NOTHING',[randomUUID(),data.shopId,data.subjectType,data.subjectId,data.event,data.eventKey,encrypt(data.email)]);
}

export async function enqueueBookingSnapshot(q:Query,shopId:string,subjectType:'booking'|'visit',subjectId:string,event:'confirmation'|'change'|'cancellation'|'reminder',eventKey:string,token?:string){
 if(!bookingEmailEnabled())return;
 if(event==='change'||event==='cancellation')await q.query("UPDATE booking_email_outbox SET state=CASE WHEN first_attempt_at IS NULL THEN 'superseded' ELSE 'uncertain' END,payload_ciphertext=CASE WHEN first_attempt_at IS NULL THEN NULL ELSE payload_ciphertext END,updated_at=now() WHERE shop_id=$1 AND subject_type=$2 AND subject_id=$3 AND event='reminder' AND state='pending'",[shopId,subjectType,subjectId]);
 const r=subjectType==='booking'?await q.query(`SELECT g.email,s.name AS shop_name,e.service_name,e.starts_at,e.ends_at,b.name AS barber_name FROM schedule_entries e JOIN guest_booking_links g ON g.entry_id=e.id JOIN shops s ON s.id=e.shop_id JOIN barbers b ON b.id=e.barber_id AND b.shop_id=e.shop_id WHERE e.id=$1 AND e.shop_id=$2 AND NOT e.onboarding_test AND e.community_event_id IS NULL AND NOT EXISTS (SELECT 1 FROM deposit_holds h WHERE h.booking_entry_id=e.id)`,[subjectId,shopId]):await q.query(`SELECT v.email,s.name AS shop_name,e.service_name,e.starts_at,e.ends_at,b.name AS barber_name,e.customer_name FROM guest_visits v JOIN shops s ON s.id=v.shop_id JOIN guest_visit_people p ON p.visit_id=v.id AND p.shop_id=v.shop_id JOIN schedule_entries e ON e.id=p.entry_id JOIN barbers b ON b.id=e.barber_id AND b.shop_id=e.shop_id WHERE v.id=$1 AND v.shop_id=$2 ORDER BY p.position`,[subjectId,shopId]);
 if(!r.rowCount)return;
 const format=(value:Date)=>new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(value);
 const description=subjectType==='visit'?'whānau visit':'booking',subject=event==='confirmation'?`Your ${description} is confirmed`:event==='change'?`Your ${description} has changed`:event==='cancellation'?`Your ${description} is cancelled`:`Reminder for your ${description}`;
 const details=r.rows.map(row=>`${row.customer_name?row.customer_name+' · ':''}${row.service_name} · ${row.barber_name} · ${format(row.starts_at)} – ${format(row.ends_at)}`).join('\n');
 let link='';if(token){const origin=new URL(process.env.POPIN_PUBLIC_ORIGIN||'');if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||(bookingEmailTestEnabled()?(origin.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)):origin.protocol!=='https:'))throw Error('A valid booking email origin is required.');link=`\n\nManage your ${description}: ${origin.origin}/${subjectType==='visit'?'visit':'manage'}#${token}`}
 await enqueueBookingEmail(q,{shopId,subjectType,subjectId,event,eventKey,email:{to:r.rows[0].email,subject,text:`${subject} at ${r.rows[0].shop_name}.\n\n${details}${link}`}});
}

// The provider must deduplicate identical payloads for this event key for 24 hours.
// Stop at 23 hours to leave a margin; never automatically resend an uncertain older send.
export async function dispatchBookingEmail(provider:BookingEmailProvider){
 if(!bookingEmailEnabled())throw Error('Booking email delivery is disabled.');
 await db.query("UPDATE booking_email_outbox SET state='uncertain',lease_until=NULL,updated_at=now() WHERE state IN ('pending','sending') AND first_attempt_at<=now()-interval '23 hours'");
 const claimed=await db.query(`UPDATE booking_email_outbox SET state='sending',first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '2 minutes',attempts=attempts+1,updated_at=now() WHERE id=(SELECT id FROM booking_email_outbox WHERE (state='pending' OR (state='sending' AND lease_until<now())) AND (first_attempt_at IS NULL OR first_attempt_at>now()-interval '23 hours') ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,shop_id,subject_type,subject_id,event,event_key,payload_ciphertext,attempts`);
 if(!claimed.rowCount)return {status:'none' as const};
 const row=claimed.rows[0];
 if(row.event==='reminder'){
  const current=row.subject_type==='booking'?await db.query("SELECT e.starts_at FROM schedule_entries e JOIN beta_reminder_consent c ON c.entry_id=e.id AND c.email WHERE e.id=$1 AND e.shop_id=$2 AND e.status='booked' AND NOT e.suppress_reminders AND e.starts_at>now()",[row.subject_id,row.shop_id]):await db.query("SELECT min(e.starts_at) AS starts_at FROM guest_visits v JOIN beta_visit_reminder_consent c ON c.visit_id=v.id AND c.email JOIN guest_visit_people p ON p.visit_id=v.id AND p.shop_id=v.shop_id JOIN schedule_entries e ON e.id=p.entry_id AND e.shop_id=p.shop_id WHERE v.id=$1 AND v.shop_id=$2 AND v.status='booked' GROUP BY v.id HAVING count(*)>=2 AND bool_and(e.status='booked' AND NOT e.suppress_reminders) AND min(e.starts_at)>now()",[row.subject_id,row.shop_id]);
  if(!current.rowCount||current.rows[0].starts_at.toISOString()!==row.event_key.slice(row.event_key.lastIndexOf('/')+1)){const state=row.attempts>1?'uncertain':'superseded';await db.query("UPDATE booking_email_outbox SET state=$2,payload_ciphertext=CASE WHEN $2='superseded' THEN NULL ELSE payload_ciphertext END,lease_until=NULL,updated_at=now() WHERE id=$1 AND state='sending'",[row.id,state]);return {status:state as 'uncertain'|'superseded',id:row.id}}
 }
 try{const message=decrypt(row.payload_ciphertext);if(!permittedRecipient(message.to)){await db.query("UPDATE booking_email_outbox SET state='superseded',payload_ciphertext=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND state='sending'",[row.id]);return {status:'superseded' as const,id:row.id}}const result=await provider.send(message,row.event_key);if(!result.id)throw Error('Provider acknowledgement missing.');await db.query("UPDATE booking_email_outbox SET state='sent',provider_id=$2,payload_ciphertext=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND state='sending'",[row.id,result.id]);return {status:'sent' as const,id:row.id}}
 catch{await db.query("UPDATE booking_email_outbox SET state=CASE WHEN first_attempt_at<=now()-interval '23 hours' THEN 'uncertain' ELSE 'pending' END,lease_until=NULL,updated_at=now() WHERE id=$1 AND state='sending'",[row.id]);return {status:'retry' as const,id:row.id}}
}
export async function dispatchBookingEmailTest(provider:BookingEmailProvider){if(!bookingEmailTestEnabled())throw Error('Booking email dispatch is restricted to local tests.');return dispatchBookingEmail(provider)}

export function resendBookingEmailProvider():BookingEmailProvider{
 if(process.env.POPIN_BOOKING_EMAIL_ENABLED!=='true'||bookingEmailTestEnabled())throw Error('Live booking email delivery is disabled.');
 const apiKey=process.env.RESEND_API_KEY?.trim(),from=process.env.POPIN_EMAIL_FROM?.trim();
 if(!apiKey||!from)throw Error('Booking email provider is not configured.');
 return {async send(message,idempotencyKey){
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from,to:[message.to],subject:message.subject,text:message.text}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('Email provider did not confirm acceptance.');const response=await r.json();if(typeof response.id!=='string'||!response.id)throw Error('Email provider did not return an identifier.');return {id:response.id as string};
 }};
}
