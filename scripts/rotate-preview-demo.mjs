import pg from 'pg';
import bcrypt from 'bcryptjs';

// This maintenance command is deliberately limited to the fictional Rimu
// account in the Railway preview. It never changes another account.
const password=process.env.DEMO_PASSWORD;
if(process.env.POPIN_ENVIRONMENT!=='staging'||!process.env.DATABASE_URL||!password||password.length!==8||Buffer.byteLength(password,'utf8')>72)throw Error('An eight-character preview demo password and staging database are required.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try{
  await client.query('BEGIN');
  const account=await client.query("SELECT id FROM staff WHERE id='demo' AND email='demo@rimu.example' AND EXISTS (SELECT 1 FROM memberships WHERE staff_id='demo' AND shop_id='rimu') FOR UPDATE");
  if(account.rowCount!==1)throw Error('Fictional Rimu demo account not found.');
  const passwordHash=await bcrypt.hash(password,12);
  const updated=await client.query("UPDATE staff SET password_hash=$1 WHERE id='demo' AND email='demo@rimu.example' RETURNING password_hash",[passwordHash]);
  if(updated.rowCount!==1||!await bcrypt.compare(password,updated.rows[0].password_hash))throw Error('Demo password verification failed.');
  await client.query('COMMIT');
  console.log('Updated and verified the fictional Rimu demo account.');
}catch(error){await client.query('ROLLBACK');throw error}finally{await client.end()}
