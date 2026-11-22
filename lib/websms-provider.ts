import {prepareWebSmsAppointment} from './websms-appointment';

type Prepared=ReturnType<typeof prepareWebSmsAppointment>;
type Credentials={id:string;secret:string};
export type WebSmsOutcome={status:'accepted';providerId:string;parts:number}|{status:'not_dispatched';reason:string}|{status:'uncertain';reason:string;providerId?:string;parts?:number};

function fields(to:string,p:Prepared){return new URLSearchParams({to,msgCompany:p.shop,date:p.date,time:p.time,messageClass:'transactional'})}
async function token(credentials:Credentials,transport:typeof fetch){
 const r=await transport('https://api.websms.co.nz/api/connexus/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:credentials.id,client_secret:credentials.secret}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Authentication failed');const value=(await r.json()).access_token;if(typeof value!=='string'||!value)throw Error('Authentication failed');return value as string;
}
function eligible(to:string,p:Prepared){return /^642\d{7,9}$/.test(to)&&p.sendable&&p.encoding==='GSM-7'&&/^[\x20-\x7e]+$/.test(p.shop)}

// A caller must durably reserve the event before calling send; ambiguous outcomes
// are deliberately never marked safe to retry. Customer delivery stays off by default.
export async function sendWebSmsAppointment(to:string,p:Prepared,credentials:Credentials,transport:typeof fetch=fetch):Promise<WebSmsOutcome>{
 if(process.env.WEBSMS_CUSTOMER_ENABLED!=='true')return {status:'not_dispatched',reason:'Customer SMS is disabled.'};
 if(!credentials.id||!credentials.secret||!eligible(to,p))return {status:'not_dispatched',reason:'Reminder or provider configuration is not eligible.'};
 let access:string;try{access=await token(credentials,transport)}catch{return {status:'not_dispatched',reason:'WebSMS authentication failed.'}}
 try{
  const test=fields('64215550100',p);test.set('sandbox','true');
  const preview=await transport('https://api.websms.co.nz/api/connexus/sms/appointment',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/x-www-form-urlencoded'},body:test,signal:AbortSignal.timeout(12000)});
  if(!preview.ok)return {status:'not_dispatched',reason:'WebSMS sandbox verification failed.'};
  const evidence=await preview.json(),rendered=evidence.sandbox_message??evidence.message;
  if(evidence.sandbox!==true||rendered!==p.text||evidence.parts!==p.segments||evidence.parts>2)return {status:'not_dispatched',reason:'WebSMS changed the reminder or part count.'};
 }catch{return {status:'not_dispatched',reason:'WebSMS sandbox verification failed.'}}
 try{
  const r=await transport('https://api.websms.co.nz/api/connexus/sms/appointment',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/x-www-form-urlencoded'},body:fields(to,p),signal:AbortSignal.timeout(12000)});
  if(!r.ok)return {status:'uncertain',reason:'WebSMS did not confirm the send; check its status before retrying.'};
  const data=await r.json();if(typeof data.message_id!=='string'||!data.message_id||data.parts!==p.segments||data.message!==p.text)return {status:'uncertain',reason:'WebSMS returned an unexpected send response.',...(typeof data.message_id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(data.message_id)?{providerId:data.message_id}:{}),...(Number.isInteger(data.parts)&&data.parts>=1&&data.parts<=11?{parts:data.parts}:{})};
  return {status:'accepted',providerId:data.message_id,parts:data.parts};
 }catch{return {status:'uncertain',reason:'The send response was lost; check its status before retrying.'}}
}
