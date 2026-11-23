import {db} from './db';
import type {PoolClient} from 'pg';
import {hash} from './auth';

// Durable operator approval is independent of intake flags and the legacy pin.
export async function pilotInvitesEnabled(shopId:string,ownerId?:string,q:Pick<PoolClient,'query'>=db){
 if(!shopId)return false;
 try{const origin=new URL(process.env.POPIN_PUBLIC_ORIGIN||'');if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||['localhost','127.0.0.1','[::1]'].includes(origin.hostname))return false}catch{return false}
 const result=await q.query('SELECT 1 FROM shop_launch_approvals a JOIN shop_owners o ON o.shop_id=a.shop_id JOIN memberships m ON m.shop_id=o.shop_id AND m.staff_id=o.staff_id JOIN staff s ON s.id=o.staff_id WHERE o.shop_id=$1 AND ($2::text IS NULL OR o.staff_id=$2) AND s.email_verified_at IS NOT NULL AND s.verified_email=s.email LIMIT 1',[shopId,ownerId||null]);
 return Boolean(result.rowCount);
}
export async function pilotInvitationEnabled(token:unknown){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return false;
 const r=await db.query('SELECT shop_id FROM shop_invitations WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()',[hash(token)]);
 return r.rowCount?pilotInvitesEnabled(r.rows[0].shop_id):false;
}

// Publishing requires an explicitly approved shop and a separately verified
// production restore; a synthetic rehearsal does not satisfy this check.
export async function pilotPublishingEnabled(shopId:string,ownerId?:string,q:Pick<PoolClient,'query'>=db){
 if(process.env.POPIN_PILOT_RESTORE_VERIFIED!=='true'||process.env.POPIN_BOOKING_EMAIL_ENABLED!=='true'||!process.env.RESEND_API_KEY?.trim()||!process.env.POPIN_EMAIL_FROM?.trim())return false;
 const key=process.env.POPIN_BOOKING_EMAIL_KEY||'',bytes=Buffer.from(key,'base64');
 if(bytes.length!==32||bytes.toString('base64')!==key)return false;
 return pilotInvitesEnabled(shopId,ownerId,q);
}
