import assert from 'node:assert/strict';
import {checkWebSmsSandbox} from '../lib/websms-sandbox';

const requests:{url:string;body:URLSearchParams}[]=[];
const fake:typeof fetch=async(input,init)=>{
 const url=String(input),body=init?.body as URLSearchParams;
 requests.push({url,body});
 if(url.endsWith('/auth/token'))return Response.json({access_token:'test-token'});
 assert.equal(body.get('sandbox'),'true');
 assert.equal(body.get('to'),'64215550100');
 assert.equal(body.get('messageClass'),'transactional');
 assert.ok(url.endsWith('/sms/appointment'));
 const text=`Your next appointment with ${body.get('msgCompany')} is on ${body.get('date')} at ${body.get('time')}. Std SMS charges apply.`;
 return Response.json({sandbox:true,sandbox_message:text,sandbox_encoding:'GSM-7',parts:1});
};
const result=await checkWebSmsSandbox('fictional-id','fictional-secret',fake);
assert.equal(result[0].status,'tested');
assert.equal(result[1].status,'tested');
assert.equal(requests.length,3);
assert.ok(requests.every(r=>r.url.startsWith('https://api.websms.co.nz/api/connexus/')));
await assert.rejects(checkWebSmsSandbox('','',fake));
console.log('PASS: fictional appointment sandbox requests and macron replacement.');
