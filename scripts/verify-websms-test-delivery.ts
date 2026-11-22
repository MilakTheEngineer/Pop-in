import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';

process.env.DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:56467/postgres';
process.env.WEBSMS_TEST_LIVE_ENABLED='true';
process.env.WEBSMS_TEST_RECIPIENT='64215550100';
process.env.WEBSMS_CLIENT_ID='fictional';process.env.WEBSMS_CLIENT_SECRET='fictional';process.env.WEBSMS_SIGNING_SECRET='fictional-secret';
const database=await PGlite.create();
await database.exec('CREATE TABLE shops(id text primary key); INSERT INTO shops VALUES (\'test-shop\');');
await database.exec(await readFile('db/058_websms_test_delivery.sql','utf8'));
const server=new PGLiteSocketServer({db:database,port:56467,host:'127.0.0.1'});await server.start();
const {db}=await import('../lib/db');
const {sendApprovedWebSmsTest,recheckWebSmsTest,verifyWebSmsSignature,webSmsTestStatus}=await import('../lib/websms-test-delivery');
const {POST:receiveWebhook}=await import('../app/api/websms-webhook/route');
try{
 const time=String(Math.floor(Date.now()/1000)),body='{"type":"dlr"}',sig=createHmac('sha256','fictional-secret').update(`${time}.${body}`).digest('hex');
 assert.equal(verifyWebSmsSignature('fictional-secret',body,time,'v1='+sig),true);
 assert.equal(verifyWebSmsSignature('fictional-secret',body+' ',time,'v1='+sig),false);
 assert.equal(verifyWebSmsSignature('fictional-secret',body,String(Number(time)-301),'v1='+sig),false);
 let sends=0;
 const fake:typeof fetch=async(input,init)=>{
  if(String(input).endsWith('/auth/token'))return Response.json({access_token:'fictional'});
  sends++;const params=init?.body as URLSearchParams;assert.equal(params.get('to'),'64215550100');assert.equal(params.get('sandbox'),null);
  const payload=JSON.stringify({type:'dlr',messageId:'1559873',connexusMessageId:'APPTfictional',status:'DELIVRD'});
  const ts=String(Math.floor(Date.now()/1000)),signature=createHmac('sha256','fictional-secret').update(`${ts}.${payload}`).digest('hex');
  const receipt=await receiveWebhook(new Request('https://example.test/api/websms-webhook',{method:'POST',headers:{'x-websms-timestamp':ts,'x-websms-signature':'v1='+signature},body:payload}));assert.equal(receipt.status,200);
  return Response.json({message_id:'1559873',parts:1,message:'Your next appointment with Rimu is on 15/12 at 2:30pm. Std SMS charges apply.'});
 };
 assert.equal((await sendApprovedWebSmsTest('test-shop',fake)).status,'accepted');
 assert.equal((await webSmsTestStatus('test-shop')).status,'delivered','receipt arriving before send response is matched');
 assert.equal((await sendApprovedWebSmsTest('test-shop',fake)).status,'already_attempted');assert.equal(sends,1);
 await db.query("UPDATE websms_test_reminder SET status='accepted'");
 const statusProvider:typeof fetch=async(input,init)=>String(input).endsWith('/auth/token')?Response.json({access_token:'fictional'}):Response.json({messages:[{message_id:(init?.body as URLSearchParams).get('message_id'),status:'DELIVRD'}]});
 assert.equal((await recheckWebSmsTest('test-shop',statusProvider)).status,'delivered');assert.equal(sends,1,'status checks do not send another text');
 await db.query('DELETE FROM websms_test_reminder');await db.query('DELETE FROM websms_test_receipt');
 const lost:typeof fetch=async(input)=>{if(String(input).endsWith('/auth/token'))return Response.json({access_token:'fictional'});sends++;throw Error('lost response')};
 assert.equal((await sendApprovedWebSmsTest('test-shop',lost)).status,'uncertain');
 assert.equal((await sendApprovedWebSmsTest('test-shop',lost)).status,'already_attempted');assert.equal(sends,2);
 console.log('PASS: signed reports, early receipt, one send, and lost-response retry prevention. Mock only.');
}finally{await db.end();await server.stop();await database.close()}
