import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import bcrypt from 'bcryptjs';
import {db} from '@/lib/db';
import {sameOrigin} from '@/lib/request-origin';
import {currentStaff,signIn} from '@/lib/auth';
import {smokeConfig,smokeCookie,smokeSecretValid} from '@/lib/smoke-config';
import {smokeCapability,smokeShop,decryptSmoke} from '@/lib/isolated-smoke';
import {approveShopLaunch} from '@/lib/shop-launch';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:'Unavailable'},404);
 const cfg=smokeConfig();if(!cfg||cfg.expires<=Date.now())return reply({error:'Unavailable'},404);
 try{
  const d=await request.json();
  if(d.action==='unlock'){
   if(!smokeSecretValid(d.secret))return reply({error:'Unavailable'},404);
   (await cookies()).set(smokeCookie,d.secret,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:Math.min(7200,Math.floor((cfg.expires-Date.now())/1000))});return reply({ok:true});
  }
  if(!await smokeCapability())return reply({error:'Unavailable'},404);
  let fixture=await smokeShop(cfg.shopId);
  if(d.action==='initialize'){
   if(fixture||cfg.expires-Date.now()>7200000||typeof d.ownerPassword!=='string'||typeof d.operatorPassword!=='string'||[d.ownerPassword,d.operatorPassword].some(p=>p.length<16||Buffer.byteLength(p)>72))return reply({error:'Initialization unavailable'},400);
   const q=await db.connect();try{
    await q.query('BEGIN');await q.query("SELECT pg_advisory_xact_lock(625062)");
    if((await q.query('SELECT 1 FROM isolated_smoke LIMIT 1')).rowCount)throw Error('Only one fixture is permitted');
    const ownerId=cfg.shopId+'-owner',operatorId=cfg.shopId+'-operator';
    await q.query('INSERT INTO staff(id,email,password_hash,name) VALUES($1,$2,$3,$4),($5,$6,$7,$8)',[ownerId,cfg.emails.find(e=>e.startsWith('owner-')),await bcrypt.hash(d.ownerPassword,12),'Isolated test owner',operatorId,cfg.emails.find(e=>e.startsWith('operator-')),await bcrypt.hash(d.operatorPassword,12),'Isolated test operator']);
    await q.query("INSERT INTO shops(id,name,location,street_address,public_slug,booking_published) VALUES($1,'Isolated Varello smoke','Rotorua','Fictional test address',$1,false)",[cfg.shopId]);
    await q.query('INSERT INTO memberships(staff_id,shop_id) VALUES($1,$2),($3,$2)',[ownerId,cfg.shopId,operatorId]);await q.query('INSERT INTO shop_owners(staff_id,shop_id) VALUES($1,$2)',[ownerId,cfg.shopId]);
    await q.query('INSERT INTO isolated_smoke(shop_id,owner_id,operator_id,emails,expires_at) VALUES($1,$2,$3,$4,$5)',[cfg.shopId,ownerId,operatorId,cfg.emails,new Date(cfg.expires)]);
    await q.query("UPDATE location_groups SET plan_code='pro' WHERE id=(SELECT location_group_id FROM shops WHERE id=$1)",[cfg.shopId]);
    await q.query('COMMIT');await signIn(ownerId,cfg.shopId);return reply({ok:true,shopId:cfg.shopId});
   }catch{await q.query('ROLLBACK');return reply({error:'Initialization failed'},400)}finally{q.release()}
  }
  if(!fixture||fixture.closed_at)return reply({error:'Unavailable'},404);
  const user=await currentStaff();
  if(d.action==='captures'){
   // The deployment capability itself is the capture-reader permission; staff
   // session permissions still govern every ordinary owner/staff action.
   const rows=(await db.query('SELECT id,kind,payload_ciphertext FROM isolated_smoke_capture WHERE shop_id=$1 ORDER BY id',[cfg.shopId])).rows;
   return reply({messages:rows.map(r=>({kind:r.kind,message:r.payload_ciphertext?decryptSmoke(r.payload_ciphertext,r.kind):null}))});
  }
  if(d.action==='approve'){
   if(!user||user.id!==fixture.operator_id)return reply({error:'Fixture operator required'},403);
   return reply(await approveShopLaunch(cfg.shopId,user.id));
  }
  if(d.action==='inspect'){
   const counts=await db.query(`SELECT
    (SELECT count(*)::int FROM booking_email_outbox WHERE shop_id=$1) AS queued_email,
    (SELECT count(*)::int FROM sms_reminder_outbox WHERE shop_id=$1) AS queued_sms,
    (SELECT count(*)::int FROM calendar_integrations WHERE shop_id=$1) AS calendars,
    (SELECT count(*)::int FROM deposit_merchants WHERE shop_id=$1) AS payments,
    (SELECT booking_published FROM shops WHERE id=$1) AS published`,[cfg.shopId]);return reply(counts.rows[0]);
  }
  if(d.action==='close'){
   if(!user||user.id!==fixture.operator_id)return reply({error:'Fixture operator required'},403);
   const q=await db.connect();try{await q.query('BEGIN');
    await q.query('UPDATE shops SET booking_published=false WHERE id=$1',[cfg.shopId]);
    await q.query("UPDATE schedule_entries SET status='cancelled',suppress_reminders=true WHERE shop_id=$1 AND status IN ('booked','blocked')",[cfg.shopId]);
    await q.query('UPDATE shop_invitations SET revoked_at=now() WHERE shop_id=$1 AND revoked_at IS NULL',[cfg.shopId]);
    await q.query('DELETE FROM shop_launch_approvals WHERE shop_id=$1',[cfg.shopId]);
    await q.query('DELETE FROM sessions WHERE staff_id IN (SELECT id FROM staff WHERE email=ANY($1::text[]))',[fixture.emails]);
    await q.query('DELETE FROM owner_email_verification_tokens WHERE staff_id IN (SELECT id FROM staff WHERE email=ANY($1::text[]))',[fixture.emails]);
    await q.query('DELETE FROM owner_password_recovery_tokens WHERE staff_id IN (SELECT id FROM staff WHERE email=ANY($1::text[]))',[fixture.emails]);
    await q.query('DELETE FROM guest_booking_links WHERE entry_id IN (SELECT id FROM schedule_entries WHERE shop_id=$1)',[cfg.shopId]);
    await q.query('DELETE FROM memberships WHERE shop_id=$1',[cfg.shopId]);
    await q.query("UPDATE location_groups SET plan_code='free' WHERE id=(SELECT location_group_id FROM shops WHERE id=$1)",[cfg.shopId]);
    await q.query('UPDATE shop_hours SET closed=true WHERE shop_id=$1',[cfg.shopId]);
    await q.query('DELETE FROM isolated_smoke_capture WHERE shop_id=$1',[cfg.shopId]);
    await q.query('UPDATE isolated_smoke SET closed_at=now() WHERE shop_id=$1',[cfg.shopId]);
    const pending=await q.query('SELECT (SELECT count(*) FROM booking_email_outbox WHERE shop_id=$1)+(SELECT count(*) FROM sms_reminder_outbox WHERE shop_id=$1) AS n',[cfg.shopId]);if(Number(pending.rows[0].n)!==0)throw Error('Unexpected pending sends');
    await q.query('COMMIT');return reply({closed:true,pendingSends:0,approvalRevoked:true,invitesRevoked:true,sessionsRevoked:true,membershipsRevoked:true,manageLinksRevoked:true,capturesDeleted:true,plan:'free'});
   }catch{await q.query('ROLLBACK');return reply({error:'Cleanup failed'},500)}finally{q.release()}
  }
  return reply({error:'Unavailable'},404);
 }catch{return reply({error:'Fixture action failed'},400)}
}
