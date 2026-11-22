import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {db} from './db';
import {planSnapshot} from './plan-limits';
import {enqueueBookingSnapshot} from './booking-email-outbox';
import {prepareWebSmsAppointment} from './websms-appointment';
import {sendWebSmsAppointment,type WebSmsOutcome} from './websms-provider';
import {normalizeSmsPhone as phone,smsConfigured} from './sms-availability';

type Subject='booking'|'visit';
type Sender=(to:string,p:ReturnType<typeof prepareWebSmsAppointment>)=>Promise<WebSmsOutcome>;
const enabled=()=>process.env.WEBSMS_CUSTOMER_ENABLED==='true';
export function smsSendingHours(at=new Date()){const hour=Number(new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',hour:'2-digit',hourCycle:'h23'}).format(at));return hour>=7&&hour<22}

// Only current, consented future appointments can enter the queue. Existing
// sent/uncertain records cannot be recreated after a change or retry.
export async function enqueueDueSmsReminders(at=new Date()){
 if(!enabled())return 0;
 const r=await db.query(`WITH subjects AS (
  SELECT e.shop_id,'booking'::text AS kind,e.id,e.starts_at FROM schedule_entries e
   JOIN beta_reminder_consent c ON c.entry_id=e.id AND c.sms AND c.sms_phone IS NOT NULL
   WHERE e.kind='appointment' AND e.status='booked' AND NOT e.suppress_reminders AND NOT e.onboarding_test
   AND NOT EXISTS(SELECT 1 FROM guest_visit_people p WHERE p.entry_id=e.id)
  UNION ALL
  SELECT v.shop_id,'visit',v.id,min(e.starts_at) FROM guest_visits v JOIN beta_visit_reminder_consent c ON c.visit_id=v.id AND c.sms AND c.sms_phone IS NOT NULL
   JOIN guest_visit_people p ON p.visit_id=v.id AND p.shop_id=v.shop_id JOIN schedule_entries e ON e.id=p.entry_id AND e.shop_id=p.shop_id
   WHERE v.status='booked' GROUP BY v.id,v.shop_id HAVING count(*)>=2 AND bool_and(e.status='booked' AND NOT e.suppress_reminders AND NOT e.onboarding_test)
 ) INSERT INTO sms_reminder_outbox(id,shop_id,subject_type,subject_id,starts_at)
 SELECT gen_random_uuid()::text,s.shop_id,s.kind,s.id,s.starts_at FROM subjects s JOIN reminder_settings r ON r.shop_id=s.shop_id AND r.enabled AND r.channel='sms'
 WHERE s.starts_at>$1 AND s.starts_at<=$1::timestamptz+r.lead_minutes*interval '1 minute'
 ON CONFLICT(shop_id,subject_type,subject_id) DO UPDATE SET starts_at=EXCLUDED.starts_at,state='pending',segments=0,billing_month=NULL,updated_at=now()
 WHERE sms_reminder_outbox.state='superseded' AND sms_reminder_outbox.starts_at<>EXCLUDED.starts_at RETURNING id`,[at]);return r.rowCount??0;
}

type Locked={name:string;mobile:string;startsAt:Date;emailConsent:boolean};
async function lockCurrent(q:PoolClient,row:{shop_id:string;subject_type:Subject;subject_id:string;starts_at:Date}):Promise<Locked|null>{
 const setting=await q.query("SELECT lead_minutes FROM reminder_settings WHERE shop_id=$1 AND enabled AND channel='sms' FOR UPDATE",[row.shop_id]);if(!setting.rowCount||row.starts_at.getTime()>Date.now()+setting.rows[0].lead_minutes*60000)return null;
 if(row.subject_type==='booking'){
  const r=await q.query(`SELECT s.name,e.starts_at,e.customer_phone,c.sms_phone,c.email FROM schedule_entries e JOIN shops s ON s.id=e.shop_id JOIN beta_reminder_consent c ON c.entry_id=e.id AND c.sms
  WHERE e.id=$1 AND e.shop_id=$2 AND e.kind='appointment' AND e.status='booked' AND NOT e.suppress_reminders AND NOT e.onboarding_test AND e.starts_at>now()
  AND NOT EXISTS(SELECT 1 FROM guest_visit_people p WHERE p.entry_id=e.id) FOR UPDATE OF e,c`,[row.subject_id,row.shop_id]);
  if(!r.rowCount||r.rows[0].starts_at.getTime()!==row.starts_at.getTime()||!phone(r.rows[0].sms_phone)||phone(r.rows[0].sms_phone)!==phone(r.rows[0].customer_phone))return null;
  return {name:r.rows[0].name,mobile:phone(r.rows[0].customer_phone),startsAt:r.rows[0].starts_at,emailConsent:r.rows[0].email};
 }
 const v=await q.query(`SELECT s.name,v.organiser_phone,c.sms_phone,c.email FROM guest_visits v JOIN shops s ON s.id=v.shop_id JOIN beta_visit_reminder_consent c ON c.visit_id=v.id AND c.sms WHERE v.id=$1 AND v.shop_id=$2 AND v.status='booked' FOR UPDATE OF v,c`,[row.subject_id,row.shop_id]);if(!v.rowCount||!phone(v.rows[0].sms_phone)||phone(v.rows[0].sms_phone)!==phone(v.rows[0].organiser_phone))return null;
 const entries=await q.query(`SELECT e.starts_at,e.status,e.suppress_reminders,e.onboarding_test FROM guest_visit_people p JOIN schedule_entries e ON e.id=p.entry_id AND e.shop_id=p.shop_id WHERE p.visit_id=$1 AND p.shop_id=$2 ORDER BY e.id FOR UPDATE OF e`,[row.subject_id,row.shop_id]);
 if((entries.rowCount??0)<2||entries.rows.some(x=>x.status!=='booked'||x.suppress_reminders||x.onboarding_test))return null;
 const first=new Date(Math.min(...entries.rows.map(x=>x.starts_at.getTime())));if(first.getTime()!==row.starts_at.getTime()||first.getTime()<=Date.now())return null;
 return {name:v.rows[0].name,mobile:phone(v.rows[0].organiser_phone),startsAt:first,emailConsent:v.rows[0].email};
}

export async function dispatchSmsReminder(sender:Sender= (to,p)=>sendWebSmsAppointment(to,p,{id:process.env.WEBSMS_CLIENT_ID||'',secret:process.env.WEBSMS_CLIENT_SECRET||''}),at=new Date(),ready=smsConfigured){
 if(!enabled())return {status:'disabled' as const};
 // WebSMS queues overnight sends; do not hand it messages which could become
 // stale before the provider releases them in the morning.
 if(!smsSendingHours(at))return {status:'quiet_hours' as const};
 // Never retry a crash or lost provider response automatically.
 await db.query("UPDATE sms_reminder_outbox SET state='uncertain',updated_at=now() WHERE state='sending' AND updated_at<now()-interval '2 minutes'");
 const q=await db.connect();let row:{id:string;shop_id:string;subject_type:Subject;subject_id:string;starts_at:Date}|undefined;let reservedMobile='',reservedText='';
 try{await q.query('BEGIN');const claim=await q.query("SELECT id,shop_id,subject_type,subject_id,starts_at FROM sms_reminder_outbox WHERE state='pending' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");if(!claim.rowCount){await q.query('COMMIT');return {status:'none' as const}}row=claim.rows[0];
  if(!await ready(row!.shop_id)){await q.query("UPDATE sms_reminder_outbox SET state='failed',updated_at=now() WHERE id=$1",[row!.id]);await q.query('COMMIT');return {status:'unavailable' as const}}
  const current=await lockCurrent(q,row!);if(!current||!current.mobile){await q.query("UPDATE sms_reminder_outbox SET state=$2,updated_at=now() WHERE id=$1",[row!.id,current?'failed':'superseded']);await q.query('COMMIT');return {status:'superseded' as const}}
  const p=prepareWebSmsAppointment(current.name,current.startsAt);if(!p.sendable||p.encoding!=='GSM-7'||!/^[\x20-\x7e]+$/.test(p.shop)){if(current.emailConsent)await enqueueBookingSnapshot(q,row!.shop_id,row!.subject_type,row!.subject_id,'reminder',`reminder/${row!.subject_type}/${row!.subject_id}/${row!.starts_at.toISOString()}`);await q.query("UPDATE sms_reminder_outbox SET state='failed',updated_at=now() WHERE id=$1",[row!.id]);await q.query('COMMIT');return {status:'unsupported' as const}}
  reservedMobile=current.mobile;reservedText=p.text;
  await q.query('SELECT id FROM beta_sms_pilot_lock WHERE id=1 FOR UPDATE');const plan=await planSnapshot(q,row!.shop_id,true);
  const month=(await q.query("SELECT date_trunc('month',now() AT TIME ZONE 'Pacific/Auckland')::date AS month")).rows[0].month;
  const usage=await q.query(`SELECT coalesce(sum(o.segments) FILTER(WHERE s.location_group_id=$1),0)::int AS used,coalesce(sum(o.segments),0)::int AS total FROM sms_reminder_outbox o JOIN shops s ON s.id=o.shop_id WHERE o.billing_month=$2 AND o.state IN ('sending','accepted','delivered','undelivered','uncertain')`,[plan.groupId,month]);
  const limit=Number(process.env.WEBSMS_PILOT_MAX_PARTS||0);if(!Number.isSafeInteger(limit)||limit<1||usage.rows[0].used+p.segments>plan.plan.smsSegments||usage.rows[0].total+p.segments>limit){
   if(current.emailConsent)await enqueueBookingSnapshot(q,row!.shop_id,row!.subject_type,row!.subject_id,'reminder',`reminder/${row!.subject_type}/${row!.subject_id}/${row!.starts_at.toISOString()}`);
   await q.query("UPDATE sms_reminder_outbox SET state='failed',updated_at=now() WHERE id=$1",[row!.id]);await q.query('COMMIT');return {status:'capped' as const};
  }
  await q.query("UPDATE sms_reminder_outbox SET state='sending',segments=$2,billing_month=$3,updated_at=now() WHERE id=$1",[row!.id,p.segments,month]);await q.query('COMMIT');
 }catch(e){await q.query('ROLLBACK');throw e}finally{q.release()}
 const send=await db.connect();try{await send.query('BEGIN');const locked=await send.query("SELECT id,shop_id,subject_type,subject_id,starts_at FROM sms_reminder_outbox WHERE id=$1 AND state='sending' FOR UPDATE",[row!.id]);if(!locked.rowCount){await send.query('COMMIT');return {status:'uncertain' as const}}
  const current=await lockCurrent(send,locked.rows[0]);if(!enabled()||!await ready(row!.shop_id)||!current||current.mobile!==reservedMobile||prepareWebSmsAppointment(current.name,current.startsAt).text!==reservedText){await send.query("UPDATE sms_reminder_outbox SET state='superseded',segments=0,updated_at=now() WHERE id=$1",[row!.id]);await send.query('COMMIT');return {status:'superseded' as const}}
  const result=await sender(current.mobile,prepareWebSmsAppointment(current.name,current.startsAt));
  if(result.status==='accepted')await send.query("UPDATE sms_reminder_outbox SET provider_id=$2,state=COALESCE((SELECT CASE status WHEN 'DELIVRD' THEN 'delivered' ELSE 'undelivered' END FROM sms_delivery_receipts WHERE provider_id=$2),'accepted'),updated_at=now() WHERE id=$1",[row!.id,result.providerId]);
  else {if(result.status==='not_dispatched'&&current.emailConsent)await enqueueBookingSnapshot(send,row!.shop_id,row!.subject_type,row!.subject_id,'reminder',`reminder/${row!.subject_type}/${row!.subject_id}/${row!.starts_at.toISOString()}`);await send.query("UPDATE sms_reminder_outbox SET state=CASE WHEN $2='uncertain' THEN COALESCE((SELECT CASE status WHEN 'DELIVRD' THEN 'delivered' ELSE 'undelivered' END FROM sms_delivery_receipts WHERE provider_id=$3),'uncertain') ELSE $2 END,provider_id=$3,segments=CASE WHEN $2='failed' THEN 0 ELSE greatest(segments,coalesce($4,segments)) END,updated_at=now() WHERE id=$1",[row!.id,result.status==='uncertain'?'uncertain':'failed',result.status==='uncertain'?result.providerId??null:null,result.status==='uncertain'?result.parts??null:null]);}
  await send.query('COMMIT');return {status:result.status};
 }catch(e){await send.query('ROLLBACK');throw e}finally{send.release()}
}

export async function recordSmsDelivery(providerId:string,status:string){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(providerId)||!['DELIVRD','UNDELIV','BLOCKED'].includes(status))return;
 const q=await db.connect();try{await q.query('BEGIN');await q.query("INSERT INTO sms_delivery_receipts(provider_id,status) VALUES($1,$2) ON CONFLICT(provider_id) DO UPDATE SET status=EXCLUDED.status,received_at=now()",[providerId,status]);await q.query("UPDATE sms_reminder_outbox SET state=CASE WHEN $2='DELIVRD' THEN 'delivered' ELSE 'undelivered' END,updated_at=now() WHERE provider_id=$1 AND state IN ('sending','accepted','uncertain')",[providerId,status]);await q.query('COMMIT')}catch(e){await q.query('ROLLBACK');throw e}finally{q.release()}
}

// A status check never resends a reminder. A missing provider ID needs manual
// investigation because the provider may have accepted a lost response.
export async function recheckSmsReminder(shopId:string,id:string,transport:typeof fetch=fetch){
 const row=await db.query("SELECT provider_id FROM sms_reminder_outbox WHERE shop_id=$1 AND id=$2 AND state IN ('accepted','uncertain')",[shopId,id]);
 const providerId=row.rows[0]?.provider_id;
 if(!providerId)throw new Error('No provider ID is available. Contact support before attempting another send.');
 const auth=await transport('https://api.websms.co.nz/api/connexus/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.WEBSMS_CLIENT_ID||'',client_secret:process.env.WEBSMS_CLIENT_SECRET||''}),signal:AbortSignal.timeout(12000)});
 if(!auth.ok)throw new Error('Status check unavailable.');
 const token=(await auth.json()).access_token;if(typeof token!=='string'||!token)throw new Error('Status check unavailable.');
 const response=await transport('https://api.websms.co.nz/api/connexus/sms/status/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({message_id:providerId}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('Status check unavailable.');
 const data=await response.json();const match=Array.isArray(data.messages)?data.messages.find((x:{message_id:unknown})=>String(x.message_id)===providerId):null;
 if(match&&['DELIVRD','UNDELIV','BLOCKED'].includes(match.status))await recordSmsDelivery(providerId,match.status);
 return {ok:true};
}
