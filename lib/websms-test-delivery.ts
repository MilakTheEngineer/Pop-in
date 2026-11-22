import {createHmac,timingSafeEqual} from 'node:crypto';
import {db} from './db';
import {prepareWebSmsAppointment} from './websms-appointment';

const id='approved-pilot-sms-test-2026-11-22';
export function verifyWebSmsSignature(secret:string,body:string,timestamp:string,header:string,now=Date.now()){
 if(!secret||!/^\d+$/.test(timestamp)||Math.abs(now-Number(timestamp)*1000)>300000)return false;
 const expected=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest();
 return header.split(',').some(part=>{const match=/^v1=([a-f0-9]{64})$/i.exec(part.trim());if(!match)return false;return timingSafeEqual(expected,Buffer.from(match[1],'hex'))});
}
export async function recordWebSmsReceipt(providerId:string,status:string){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(providerId)||!['DELIVRD','UNDELIV'].includes(status))return;
 const client=await db.connect();try{await client.query('BEGIN');
  await client.query("INSERT INTO websms_test_receipt(provider_id,status) SELECT $1,$2 WHERE EXISTS (SELECT 1 FROM websms_test_reminder WHERE provider_id=$1 OR status='sending') ON CONFLICT(provider_id) DO UPDATE SET status=EXCLUDED.status,received_at=now()",[providerId,status]);
  await client.query("UPDATE websms_test_reminder SET status=CASE WHEN $2='DELIVRD' THEN 'delivered' ELSE 'undelivered' END,updated_at=now() WHERE provider_id=$1 AND status IN ('sending','accepted','uncertain')",[providerId,status]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
export async function webSmsTestStatus(shopId:string){const r=await db.query('SELECT status,parts FROM websms_test_reminder WHERE id=$1 AND shop_id=$2',[id,shopId]);return r.rows[0]||null}
export async function recheckWebSmsTest(shopId:string,transport:typeof fetch=fetch){
 const row=await db.query('SELECT provider_id FROM websms_test_reminder WHERE id=$1 AND shop_id=$2',[id,shopId]);
 const providerId=row.rows[0]?.provider_id;if(!providerId)throw new Error('No provider ID is available to check.');
 const auth=await transport('https://api.websms.co.nz/api/connexus/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.WEBSMS_CLIENT_ID||'',client_secret:process.env.WEBSMS_CLIENT_SECRET||''}),signal:AbortSignal.timeout(12000)});
 if(!auth.ok)throw new Error('WebSMS authentication failed.');const token=(await auth.json()).access_token;if(typeof token!=='string'||!token)throw new Error('WebSMS authentication failed.');
 const response=await transport('https://api.websms.co.nz/api/connexus/sms/status/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({message_id:providerId}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('WebSMS status check failed.');const data=await response.json();
 const match=Array.isArray(data.messages)?data.messages.find((x:{message_id:unknown})=>String(x.message_id)===providerId):null;
 if(match&&['DELIVRD','UNDELIV'].includes(match.status))await recordWebSmsReceipt(providerId,match.status);
 return webSmsTestStatus(shopId);
}
export async function sendApprovedWebSmsTest(shopId:string,transport:typeof fetch=fetch){
 if(process.env.WEBSMS_TEST_LIVE_ENABLED!=='true')throw new Error('The one-time SMS test is not enabled.');
 const recipient=process.env.WEBSMS_TEST_RECIPIENT||'',clientId=process.env.WEBSMS_CLIENT_ID||'',secret=process.env.WEBSMS_CLIENT_SECRET||'';
 if(!/^642\d{7,9}$/.test(recipient)||!clientId||!secret||!process.env.WEBSMS_SIGNING_SECRET)throw new Error('The SMS test is not configured.');
 const prepared=prepareWebSmsAppointment('Rimu',new Date('2026-12-15T01:30:00Z'));
 if(prepared.segments!==1)throw new Error('The test reminder does not fit one part.');
 const auth=await transport('https://api.websms.co.nz/api/connexus/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:secret}),signal:AbortSignal.timeout(12000)});
 if(!auth.ok)throw new Error('WebSMS authentication failed.');
 const token=(await auth.json()).access_token;if(typeof token!=='string'||!token)throw new Error('WebSMS authentication failed.');
 const inserted=await db.query("INSERT INTO websms_test_reminder(id,shop_id,status) VALUES($1,$2,'sending') ON CONFLICT(id) DO NOTHING RETURNING id",[id,shopId]);
 if(!inserted.rowCount)return {status:'already_attempted' as const};
 try{
  const body=new URLSearchParams({to:recipient,msgCompany:prepared.shop,date:prepared.date,time:prepared.time,messageClass:'transactional'});
  const response=await transport('https://api.websms.co.nz/api/connexus/sms/appointment',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Provider did not confirm the send');
  const result=await response.json();const providerId=result.message_id;
  if(typeof providerId!=='string'||!providerId||result.parts!==1||result.message!==prepared.text)throw new Error('Provider response could not be verified');
  await db.query("UPDATE websms_test_reminder SET provider_id=$2,parts=1,status=COALESCE((SELECT CASE status WHEN 'DELIVRD' THEN 'delivered' ELSE 'undelivered' END FROM websms_test_receipt WHERE provider_id=$2),'accepted'),updated_at=now() WHERE id=$1",[id,providerId]);
  return {status:'accepted' as const};
 }catch{await db.query("UPDATE websms_test_reminder SET status='uncertain',updated_at=now() WHERE id=$1",[id]);return {status:'uncertain' as const}}
}
