import {smokeIdentityAccess} from './isolated-smoke';
import {randomBytes,randomUUID} from 'node:crypto';
import {db} from './db';
import {hash} from './auth';
import {BookingError} from './booking';
import {sendTransactionalEmail,type TransactionalEmail} from './transactional-email';

export function verificationOrigin(){
 try {const url=new URL(process.env.POPIN_PUBLIC_ORIGIN||'');
  if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
  if(url.protocol==='https:'||(process.env.NODE_ENV!=='production'&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))return url.origin;
 } catch {/* Not configured. */}
 return null;
}

export async function ownerEmailState(userId:string){
 const result=await db.query('SELECT email,verified_email,email_verified_at FROM staff WHERE id=$1',[userId]);
 if(!result.rowCount)throw new BookingError('Account not found.');
 const row=result.rows[0];return {email:row.email as string,verified:!!row.email_verified_at&&row.verified_email===row.email,deliveryConfigured:!!process.env.RESEND_API_KEY?.trim()&&!!process.env.POPIN_EMAIL_FROM?.trim()&&!!verificationOrigin(),testEmailAvailable:!!process.env.POPIN_BOOKING_EMAIL_ALLOWED_RECIPIENTS?.split(',').some(value=>value.trim().toLowerCase()===String(row.email).toLowerCase())};
}

export async function sendOwnerBookingEmailTest(userId:string){
 const state=await ownerEmailState(userId);
 if(!state.deliveryConfigured||!state.testEmailAvailable)throw new BookingError('Test email is not available for this account. Contact Varello support.');
 await sendTransactionalEmail({to:state.email,subject:'Varello test: booking confirmed',text:'This is a test booking email with fictional details. No appointment was created.\n\nRimu Barbers\nStandard cut · Ari · Friday, 2:30 pm\n\nYour real booking confirmations will include the appointment details and private management link.',idempotencyKey:`owner-booking-test/${randomUUID()}`});
 return {ok:true};
}

export async function issueOwnerVerification(userId:string,send:(message:TransactionalEmail)=>Promise<unknown>=sendTransactionalEmail){
 const origin=verificationOrigin();
 if(!origin||!process.env.RESEND_API_KEY?.trim()||!process.env.POPIN_EMAIL_FROM?.trim())throw new BookingError('Email verification is not configured. Contact Varello support.');
 const token=randomBytes(32).toString('hex'),id=randomUUID(),c=await db.connect();let email='';
 try {await c.query('BEGIN');
  const user=await c.query('SELECT email,verified_email,email_verified_at FROM staff WHERE id=$1 FOR UPDATE',[userId]);
  if(!user.rowCount)throw new BookingError('Account not found.');
  const row=user.rows[0];if(row.email_verified_at&&row.verified_email===row.email){await c.query('COMMIT');return {alreadyVerified:true};}
  const recent=await c.query("SELECT count(*)::int AS n FROM owner_email_verification_tokens WHERE staff_id=$1 AND created_at>now()-interval '1 hour'",[userId]);
  if(recent.rows[0].n>=5)throw new BookingError('Too many verification requests. Try again later.');
  email=row.email;await c.query('UPDATE owner_email_verification_tokens SET invalidated_at=now() WHERE staff_id=$1 AND used_at IS NULL AND invalidated_at IS NULL',[userId]);
  await c.query("INSERT INTO owner_email_verification_tokens(id,staff_id,email,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 minutes')",[id,userId,email,hash(token)]);
  await c.query('COMMIT');
 } catch(error){await c.query('ROLLBACK');throw error} finally {c.release()}
 try {await send({to:email,subject:'Verify your Varello email',text:`Verify your Varello owner email using this private link. It expires in 30 minutes.\n\n${origin}/verify-email#${token}\n\nIf you didn’t request this, ignore this email.`,idempotencyKey:`owner-verification/${id}`});}
 catch(error){await db.query('UPDATE owner_email_verification_tokens SET invalidated_at=now() WHERE id=$1 AND used_at IS NULL',[id]);throw error}
 return {alreadyVerified:false};
}

export async function consumeOwnerVerification(value:unknown){
 if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new BookingError('This verification link is invalid or expired. Request a new one in Setup.');
 const c=await db.connect();try {await c.query('BEGIN');
  const token=await c.query(`SELECT t.id,t.staff_id,t.email FROM owner_email_verification_tokens t JOIN staff s ON s.id=t.staff_id AND s.email=t.email WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.invalidated_at IS NULL AND t.expires_at>now() AND EXISTS(SELECT 1 FROM shop_owners o JOIN memberships m ON m.staff_id=o.staff_id AND m.shop_id=o.shop_id WHERE o.staff_id=t.staff_id) FOR UPDATE OF t,s`,[hash(value)]);
  if(!token.rowCount)throw new BookingError('This verification link is invalid or expired. Request a new one in Setup.');
  const row=token.rows[0];if(!await smokeIdentityAccess(row.staff_id,c))throw new BookingError('Verification unavailable.');await c.query('UPDATE staff SET verified_email=$2,email_verified_at=now() WHERE id=$1',[row.staff_id,row.email]);
  await c.query('UPDATE owner_email_verification_tokens SET used_at=now() WHERE id=$1',[row.id]);
  await c.query('UPDATE owner_email_verification_tokens SET invalidated_at=now() WHERE staff_id=$1 AND id<>$2 AND used_at IS NULL AND invalidated_at IS NULL',[row.staff_id,row.id]);
  await c.query('COMMIT');return {ok:true};
 } catch(error){await c.query('ROLLBACK');throw error} finally {c.release()}
}
