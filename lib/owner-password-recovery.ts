import {randomBytes,randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {db} from './db';
import {hash} from './auth';
import {BookingError} from './booking';
import {verificationOrigin} from './owner-email-verification';
import {sendTransactionalEmail,type TransactionalEmail} from './transactional-email';

export const recoveryMessage='If this is a verified owner account, a recovery link will be emailed. Check your inbox, or contact Varello if you need help.';
export function ownerRecoveryAvailable(){const origin=verificationOrigin();return process.env.POPIN_OWNER_RECOVERY_ENABLED==='true'&&!!process.env.RESEND_API_KEY?.trim()&&!!process.env.POPIN_EMAIL_FROM?.trim()&&!!origin&&new URL(origin).protocol==='https:'}
export async function requestOwnerRecovery(value:unknown,send:(message:TransactionalEmail)=>Promise<unknown>=sendTransactionalEmail){
 if(!ownerRecoveryAvailable()||typeof value!=='string')return;
 const email=value.trim().toLowerCase();if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return;
 const token=randomBytes(32).toString('hex'),id=randomUUID(),c=await db.connect();let userId='';
 try{
  await c.query('BEGIN');
  const result=await c.query(`SELECT s.id FROM staff s WHERE s.email=$1 AND s.verified_email=s.email AND s.email_verified_at IS NOT NULL AND EXISTS(SELECT 1 FROM shop_owners o JOIN memberships m ON m.staff_id=o.staff_id AND m.shop_id=o.shop_id WHERE o.staff_id=s.id) FOR UPDATE OF s`,[email]);
  if(!result.rowCount){await c.query('COMMIT');return}userId=result.rows[0].id;
  const recent=await c.query("SELECT count(*)::int AS n FROM owner_password_recovery_tokens WHERE staff_id=$1 AND created_at>now()-interval '1 hour'",[userId]);
  if(recent.rows[0].n>=5){await c.query('COMMIT');return}
  await c.query('UPDATE owner_password_recovery_tokens SET invalidated_at=now() WHERE staff_id=$1 AND used_at IS NULL AND invalidated_at IS NULL',[userId]);
  await c.query("INSERT INTO owner_password_recovery_tokens(id,staff_id,email,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 minutes')",[id,userId,email,hash(token)]);await c.query('COMMIT');
 }catch(error){await c.query('ROLLBACK');throw error}finally{c.release()}
 try{await send({to:email,subject:'Recover your Varello owner account',text:`Choose a new password using this private link. It expires in 30 minutes and can be used once.\n\n${verificationOrigin()}/recover-account#${token}\n\nIf you did not request this, ignore this email. Your password has not changed.`,idempotencyKey:`owner-recovery/${id}`})}
 catch{await db.query('UPDATE owner_password_recovery_tokens SET invalidated_at=now() WHERE id=$1 AND used_at IS NULL',[id])}
}
export async function resetOwnerPassword(value:unknown,password:unknown){
 if(!ownerRecoveryAvailable()||typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new BookingError('This recovery link is invalid or expired. Request a new one.');
 if(typeof password!=='string'||password.length<8||Buffer.byteLength(password,'utf8')>72)throw new BookingError('Use a password of at least 8 characters and at most 72 UTF-8 bytes.');
 const c=await db.connect();try{
  await c.query('BEGIN');
  // Use the same account-first lock order as issuance, then recheck token validity.
  await c.query('SELECT s.id FROM staff s JOIN owner_password_recovery_tokens t ON t.staff_id=s.id WHERE t.token_hash=$1 FOR UPDATE OF s',[hash(value)]);
  const token=await c.query(`SELECT t.id,t.staff_id FROM owner_password_recovery_tokens t JOIN staff s ON s.id=t.staff_id AND s.email=t.email AND s.verified_email=s.email AND s.email_verified_at IS NOT NULL WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.invalidated_at IS NULL AND t.expires_at>now() AND EXISTS(SELECT 1 FROM shop_owners o JOIN memberships m ON m.staff_id=o.staff_id AND m.shop_id=o.shop_id WHERE o.staff_id=t.staff_id) FOR UPDATE OF t`,[hash(value)]);
  if(!token.rowCount)throw new BookingError('This recovery link is invalid or expired. Request a new one.');
  const row=token.rows[0];await c.query('UPDATE staff SET password_hash=$2 WHERE id=$1',[row.staff_id,await bcrypt.hash(password,12)]);
  await c.query('UPDATE owner_password_recovery_tokens SET used_at=now() WHERE id=$1',[row.id]);
  await c.query('UPDATE owner_password_recovery_tokens SET invalidated_at=now() WHERE staff_id=$1 AND id<>$2 AND used_at IS NULL AND invalidated_at IS NULL',[row.staff_id,row.id]);
  await c.query('DELETE FROM sessions WHERE staff_id=$1',[row.staff_id]);await c.query('COMMIT');return {ok:true};
 }catch(error){await c.query('ROLLBACK');throw error}finally{c.release()}
}
