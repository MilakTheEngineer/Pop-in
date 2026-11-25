import './local-qa-guard.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../lib/db';
import {createOwnerShop,createInvite,acceptInvite} from '../lib/onboarding';
import {planSnapshot} from '../lib/plan-limits';
const tag=randomUUID(),emails:string[]=[];let shopId='';
const email=(name:string)=>{const value=`${name}-${tag}@example.test`;emails.push(value);return value};
const password='fictional cap test password';
try{
 const owner=await createOwnerShop({name:'Fictional cap owner',shopName:'Fictional cap shop',location:'Rotorua',streetAddress:'1 Fictional Street',email:email('owner'),password});shopId=owner.shopId;
 // Current self-service access has one five-person operating limit on every legacy plan.
 const pending=await createInvite(shopId,owner.userId,email('pending'));
 assert.ok(pending.token);
 assert.equal((await planSnapshot(db,shopId)).people,1,'an unaccepted invite does not count as a person');
 for(let i=0;i<3;i++){const invitation=await createInvite(shopId,owner.userId,email('staff'+i));await acceptInvite({token:invitation.token,name:'Fictional staff',password})}
 assert.equal((await planSnapshot(db,shopId)).people,4);
 const invites=await Promise.all([createInvite(shopId,owner.userId,email('race-a')),createInvite(shopId,owner.userId,email('race-b'))]);
 const redeemed=await Promise.allSettled(invites.map(invite=>acceptInvite({token:invite.token,name:'Fictional last seat',password})));
 assert.equal(redeemed.filter(result=>result.status==='fulfilled').length,1);assert.equal((await planSnapshot(db,shopId)).people,5);
 const before=(await db.query('SELECT count(*)::int AS n FROM shop_invitations WHERE shop_id=$1',[shopId])).rows[0].n;
 await assert.rejects(()=>createInvite(shopId,owner.userId,email('over-cap')),/five-person operating limit/);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM shop_invitations WHERE shop_id=$1',[shopId])).rows[0].n,before);
 await assert.rejects(()=>acceptInvite({token:pending.token,name:'Late acceptance',password}),/five-person operating limit/);
 assert.equal((await planSnapshot(db,shopId)).people,5);
 console.log('PASS: current five-person limit permits staff invitations; concurrent acceptance grants only the last seat; at-cap invites and old pending acceptance are rejected.');
}finally{
 if(shopId)await db.query('DELETE FROM shops WHERE id=$1',[shopId]);await db.query('DELETE FROM staff WHERE email=ANY($1::text[])',[emails]);await db.end();
}
