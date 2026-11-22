import {appointmentReminder,smsSegments} from './sms-segments';

// This adapter can only call the provider's non-delivering sandbox, with fictional data.
export async function checkWebSmsSandbox(id:string,secret:string,transport:typeof fetch=fetch){
 if(!id||!secret)throw new Error('WebSMS credentials are not configured.');
 const auth=await transport('https://api.websms.co.nz/api/connexus/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:id,client_secret:secret}),signal:AbortSignal.timeout(12000)});
 if(!auth.ok)throw new Error('WebSMS authentication failed.');
 const token=(await auth.json()).access_token;
 if(typeof token!=='string'||!token)throw new Error('WebSMS did not return an access token.');
 const samples=[{name:'Short reminder',shop:'Rimu',unicode:false},{name:'Long reminder with macrons',shop:'Te Whānau o Ngā Kaimahi Hair and Beauty Rotorua',unicode:true}];
 return Promise.all(samples.map(async sample=>{
  const text=appointmentReminder(sample.shop,'2026-12-15T01:30:00Z');
  const fields=new URLSearchParams({to:'64215550100',body:text,messageClass:'transactional',sandbox:'true'});
  if(sample.unicode)fields.set('unicode','true');
  try{
   const response=await transport('https://api.websms.co.nz/api/connexus/sms/out',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/x-www-form-urlencoded'},body:fields,signal:AbortSignal.timeout(12000)});
   if(!response.ok)return {name:sample.name,status:'unavailable' as const,reason:sample.unicode?'WebSMS rejected the Unicode test; Unicode may need to be enabled on the account.':'WebSMS rejected the sandbox test.'};
   const data=await response.json();
   if(data.sandbox!==true||typeof data.sandbox_message!=='string'||typeof data.sandbox_encoding!=='string'||!Number.isInteger(data.parts)||data.parts<1)throw new Error('Invalid sandbox response');
   return {name:sample.name,status:'tested' as const,rendered:data.sandbox_message as string,encoding:data.sandbox_encoding as string,providerParts:data.parts as number,estimate:smsSegments(data.sandbox_message).segments};
  }catch{return {name:sample.name,status:'unavailable' as const,reason:'Could not verify the WebSMS sandbox response.'}}
 }));
}
