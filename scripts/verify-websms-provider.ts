import assert from 'node:assert/strict';
import {prepareWebSmsAppointment} from '../lib/websms-appointment';
import {sendWebSmsAppointment} from '../lib/websms-provider';

const prepared=prepareWebSmsAppointment('Te Whānau o Ngā Kaimahi',new Date('2026-12-15T01:30:00Z'));
let live=0,sandbox=0,mode='normal';
const fake:typeof fetch=async(input,init)=>{
 if(String(input).endsWith('/auth/token'))return Response.json({access_token:'fictional'});
 const fields=init?.body as URLSearchParams;
 if(fields.get('sandbox')==='true'){sandbox++;return Response.json({sandbox:true,message:mode==='changed'?'altered':prepared.text,parts:1})}
 live++;if(mode==='lost')throw Error('response lost');
 return Response.json({message_id:'fictional-id',message:prepared.text,parts:1});
};
const creds={id:'fictional',secret:'fictional'};
delete process.env.WEBSMS_CUSTOMER_ENABLED;
assert.equal((await sendWebSmsAppointment('64215550100',prepared,creds,fake)).status,'not_dispatched');assert.equal(live+sandbox,0);
process.env.WEBSMS_CUSTOMER_ENABLED='true';mode='changed';
assert.equal((await sendWebSmsAppointment('64215550100',prepared,creds,fake)).status,'not_dispatched');assert.equal(live,0);
mode='lost';assert.equal((await sendWebSmsAppointment('64215550100',prepared,creds,fake)).status,'uncertain');assert.equal(live,1);
mode='normal';assert.equal((await sendWebSmsAppointment('64215550100',prepared,creds,fake)).status,'accepted');assert.equal(live,2);
assert.equal((await sendWebSmsAppointment('invalid',prepared,creds,fake)).status,'not_dispatched');assert.equal(live,2);
console.log('PASS: disabled by default, sandbox verification, uncertain response and fictional accepted send. No provider contacted.');
