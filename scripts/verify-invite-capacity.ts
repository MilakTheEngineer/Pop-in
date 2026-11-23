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
 await assert.rejects(()=>createInvite(shopId,owner.userId,email('free')),/Free includes 1 person/);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM shop_invitations WHERE shop_id=$1',[shopId])).rows[0].n,0);
 await db.query("UPDATE location_groups SET plan_code='pro' WHERE id=(SELECT location_group_id FROM shops WHERE id=$1)",[shopId]);
 const stale=await createInvite(shopId,owner.userId,email('stale'));
 await db.query("UPDATE location_groups SET plan_code='free' WHERE id=(SELECT location_group_id FROM shops WHERE id=$1)",[shopId]);
 await assert.rejects(()=>acceptInvite({token:stale.token,name:'Stale invitation',password}),/Free is owner-only/);
 await db.query("UPDATE location_groups SET plan_code='pro' WHERE id=(SELECT location_group_id FROM shops WHERE id=$1)",[shopId]);
 for(let i=0;i<3;i++){const invitation=await createInvite(shopId,owner.userId,email('staff'+i));await acceptInvite({token:invitation.token,name:'Fictional staff',password})}
 assert.equal((await planSnapshot(db,shopId)).people,4);
 const invites=await Promise.all([createInvite(shopId,owner.userId,email('race-a')),createInvite(shopId,owner.userId,email('race-b'))]);
 const redeemed=await Promise.allSettled(invites.map(invite=>acceptInvite({token:invite.token,name:'Fictional last seat',password})));
 assert.equal(redeemed.filter(result=>result.status==='fulfilled').length,1);assert.equal((await planSnapshot(db,shopId)).people,5);
 const before=(await db.query('SELECT count(*)::int AS n FROM shop_invitations WHERE shop_id=$1',[shopId])).rows[0].n;
 await assert.rejects(()=>createInvite(shopId,owner.userId,email('over-cap')),/Pro includes 5 people/);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM shop_invitations WHERE shop_id=$1',[shopId])).rows[0].n,before);
 console.log('PASS: Free rejects before creating a token; old invite cannot bypass Free; actual Pro redemption and concurrent final seat retain atomic capacity; at-cap Pro creates no link.');
}finally{
 if(shopId)await db.query('DELETE FROM shops WHERE id=$1',[shopId]);await db.query('DELETE FROM staff WHERE email=ANY($1::text[])',[emails]);await db.end();
}
