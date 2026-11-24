import {createHash} from 'node:crypto';
import {db} from './db';
// Durable global and per-address budgets apply before password hashing and account creation.
export async function limitOwnerSignup(email:unknown){
 const key=createHash('sha256').update(typeof email==='string'?email.trim().toLowerCase():'invalid').digest('hex');const q=await db.connect();
 try{await q.query('BEGIN');await q.query('SELECT pg_advisory_xact_lock(640064)');await q.query("DELETE FROM owner_signup_attempts WHERE created_at<now()-interval '1 day'");const r=await q.query("SELECT count(*)::int AS total,count(*) FILTER (WHERE email_hash=$1)::int AS address FROM owner_signup_attempts WHERE created_at>now()-interval '1 hour'",[key]);if(r.rows[0].total>=100||r.rows[0].address>=5){await q.query('COMMIT');return false}await q.query('INSERT INTO owner_signup_attempts(email_hash) VALUES($1)',[key]);await q.query('COMMIT');return true}catch(e){await q.query('ROLLBACK');throw e}finally{q.release()}
}
