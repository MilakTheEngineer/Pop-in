import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../lib/db';
import {consumeOwnerVerification,issueOwnerVerification,ownerEmailState} from '../lib/owner-email-verification';
import {sendTransactionalEmail,type TransactionalEmail} from '../lib/transactional-email';

const target=new URL(process.env.DATABASE_URL||'postgresql://invalid');
if(process.env.NODE_ENV==='production'||!['127.0.0.1','localhost','[::1]'].includes(target.hostname))throw Error('Use an isolated local test database.');
const suffix=randomUUID(),shop=`email-shop-${suffix}`,user=`email-owner-${suffix}`;
process.env.RESEND_API_KEY='fictional-key';process.env.POPIN_EMAIL_FROM='Pop-in <test@example.test>';process.env.POPIN_PUBLIC_ORIGIN='http://127.0.0.1:3001';
let sent:TransactionalEmail[]=[];
try{
 await db.query('INSERT INTO shops(id,name,location) VALUES($1,$2,$3)',[shop,'Fictional shop','Rotorua']);
 await db.query('INSERT INTO staff(id,email,password_hash,name) VALUES($1,$2,$3,$4)',[user,`owner-${suffix}@example.test`,'fictional-hash','Fictional owner']);
 await db.query('INSERT INTO memberships(staff_id,shop_id) VALUES($1,$2)',[user,shop]);await db.query('INSERT INTO shop_owners(staff_id,shop_id) VALUES($1,$2)',[user,shop]);
 assert.equal((await ownerEmailState(user)).verified,false);
 await issueOwnerVerification(user,async message=>{sent.push(message)});
 const token=sent[0].text.match(/#([a-f0-9]{64})/)?.[1];assert.ok(token);assert.equal((await db.query('SELECT token_hash FROM owner_email_verification_tokens WHERE staff_id=$1',[user])).rows[0].token_hash===token,false);
 const results=await Promise.allSettled([consumeOwnerVerification(token),consumeOwnerVerification(token)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal((await ownerEmailState(user)).verified,true);
 assert.equal((await issueOwnerVerification(user,async message=>{sent.push(message)})).alreadyVerified,true);assert.equal(sent.length,1);
 await db.query('UPDATE staff SET email=$2 WHERE id=$1',[user,`changed-${suffix}@example.test`]);assert.equal((await ownerEmailState(user)).verified,false);
 await assert.rejects(issueOwnerVerification(user,async()=>{throw Error('simulated failure')}));
 assert.equal((await db.query('SELECT count(*)::int AS n FROM owner_email_verification_tokens WHERE staff_id=$1 AND used_at IS NULL AND invalidated_at IS NULL',[user])).rows[0].n,0);
 let body:Record<string,unknown>|null=null;await sendTransactionalEmail({to:'fictional@example.test',subject:'Test',text:'Fictional message',idempotencyKey:'test/unique'},async(_url,init)=>{body=JSON.parse(String(init?.body));assert.equal(new Headers(init?.headers).get('Idempotency-Key'),'test/unique');return Response.json({id:'simulated-id'})});
 assert.deepEqual((body as unknown as {to:string[]}).to,['fictional@example.test']);
 console.log('PASS: simulated provider, one-use concurrent verification, email change, failed-delivery invalidation and idempotency header.');
}finally{await db.query('DELETE FROM staff WHERE id=$1',[user]);await db.query('DELETE FROM shops WHERE id=$1',[shop]);await db.end()}
