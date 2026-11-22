import {smsSegments} from './sms-segments';
import {prepareWebSmsAppointment} from './websms-appointment';

// This adapter can only call the provider's non-delivering sandbox, with fictional data.
export async function checkWebSmsSandbox(id:string,secret:string,transport:typeof fetch=fetch){
 if(!id||!secret)throw new Error('WebSMS credentials are not configured.');
 const auth=await transport('https://api.websms.co.nz/api/connexus/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:id,client_secret:secret}),signal:AbortSignal.timeout(12000)});
 if(!auth.ok)throw new Error('WebSMS authentication failed.');
 const token=(await auth.json()).access_token;
 if(typeof token!=='string'||!token)throw new Error('WebSMS did not return an access token.');
 const samples=[{name:'Short reminder',shop:'Rimu',unicode:false},{name:'Long reminder with macrons',shop:'Te Whānau o Ngā Kaimahi Hair and Beauty Rotorua',unicode:true}];
 return Promise.all(samples.map(async sample=>{
  const prepared=prepareWebSmsAppointment(sample.shop,new Date('2026-12-15T01:30:00Z'));
  if(!prepared.sendable)return {name:sample.name,status:'unavailable' as const,reason:`Not tested: the full shop name and time require ${prepared.segments} SMS parts.`};
  const fields=new URLSearchParams({to:'64215550100',msgCompany:prepared.shop,date:prepared.date,time:prepared.time,messageClass:'transactional',sandbox:'true'});
  if(sample.unicode)fields.set('unicode','true');
  try{
   const response=await transport('https://api.websms.co.nz/api/connexus/sms/appointment',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/x-www-form-urlencoded'},body:fields,signal:AbortSignal.timeout(12000)});
   if(!response.ok)return {name:sample.name,status:'unavailable' as const,reason:sample.unicode?'WebSMS rejected the Unicode test; Unicode may need to be enabled on the account.':'WebSMS rejected the sandbox test.'};
   const data=await response.json();
   const rendered=typeof data.sandbox_message==='string'?data.sandbox_message:typeof data.message==='string'?data.message:null;
   if(data.sandbox!==true||!rendered||typeof data.sandbox_encoding!=='string'||!Number.isInteger(data.parts)||data.parts<1)return {name:sample.name,status:'unavailable' as const,reason:`WebSMS sandbox evidence missing: sandbox=${data.sandbox===true}, message=${!!rendered}, encoding=${typeof data.sandbox_encoding==='string'}, parts=${Number.isInteger(data.parts)?data.parts:'missing'}.`};
   const cost=typeof data.sandbox_would_charge==='number'?data.sandbox_would_charge:null;
   if(data.parts>2||rendered!==prepared.text)return {name:sample.name,status:'unavailable' as const,reason:`WebSMS changed the reminder wording or returned more than two parts. Do not send it live. Returned: ${rendered} (${data.sandbox_encoding}, ${data.parts} parts, sandbox estimate ${cost===null?'unavailable':`NZ$${cost}`}).`};
   return {name:sample.name,status:'tested' as const,rendered,encoding:data.sandbox_encoding as string,providerParts:data.parts as number,estimate:smsSegments(rendered).segments,wouldCharge:cost};
  }catch{return {name:sample.name,status:'unavailable' as const,reason:'Could not verify the WebSMS sandbox response.'}}
 }));
}
