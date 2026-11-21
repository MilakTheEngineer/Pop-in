'use server';
import { db } from '@/lib/db';
import { shopAccess, shopOwnerAccess, signIn, hash } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import {planSnapshot,enforcePlanGrowth} from '@/lib/plan-limits';
import {BookingError} from '@/lib/booking';
const str = (f:FormData,k:string) => String(f.get(k) ?? '').trim();
const required = (v:string, max=100) => { if (!v || v.length>max) throw new Error('Please check the form fields.'); return v; };
const time = (v:string) => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new Error('Invalid time'); return v; };
const refresh = (section:string) => revalidatePath('/settings/'+section);
export async function saveStaffAppearance(f:FormData){
 const id=str(f,'shopId'),theme=str(f,'theme');await shopOwnerAccess(id);
 if(!['pine','navy','plum','slate','terracotta'].includes(theme))throw new Error('Choose a workspace colour.');
 await db.query('INSERT INTO shop_appearance(shop_id,theme) VALUES($1,$2) ON CONFLICT(shop_id) DO UPDATE SET theme=EXCLUDED.theme',[id,theme]);
 revalidatePath('/', 'layout');
}
export async function login(f:FormData) {
 const email=str(f,'email').toLowerCase(); const password=str(f,'password');const requested=str(f,'next');const next=requested==='/onboarding'?'/onboarding':requested==='/operator'?'/operator':requested==='/beta'?'/beta':requested==='/beta?kind=founding'?'/beta?kind=founding':'/today';
 const r=await db.query('SELECT id,password_hash FROM staff WHERE email=$1',[email]);
 if (!r.rowCount || !(await bcrypt.compare(password,r.rows[0].password_hash))) redirect('/login?error=1'+(next==='/onboarding'?'&next=onboarding':next==='/operator'?'&next=operator':next==='/beta'?'&next=beta':next==='/beta?kind=founding'?'&next=founder':''));
 await signIn(r.rows[0].id); redirect(next);
}
export async function logout() { const c=await cookies(); const token=c.get('popin_session')?.value; if(token) await db.query('DELETE FROM sessions WHERE id_hash=$1',[hash(token)]); c.delete('popin_session');c.delete('popin_shop'); redirect('/login'); }
export async function switchShop(f:FormData){const id=required(str(f,'shopId'));await shopAccess(id);(await cookies()).set('popin_shop',id,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:604800});redirect('/today');}
export async function saveShop(f:FormData) {
 const id=str(f,'shopId'); await shopOwnerAccess(id); const name=required(str(f,'name')); const location=required(str(f,'location')); const address=required(str(f,'streetAddress'),200); const accent=str(f,'accent'); if(!/^#[0-9a-fA-F]{6}$/.test(accent)) throw new Error('Invalid colour');
 const photo=f.get('photo');
 if(photo instanceof File && photo.size) { if(photo.size>3_000_000 || !['image/jpeg','image/png','image/webp'].includes(photo.type)) throw new Error('Photo must be a JPEG, PNG or WebP under 3 MB.'); await db.query('UPDATE shops SET name=$1,location=$2,street_address=$3,accent=$4,photo=$5,photo_type=$6 WHERE id=$7',[name,location,address,accent,Buffer.from(await photo.arrayBuffer()),photo.type,id]); }
 else if(f.has('removePhoto')) await db.query('UPDATE shops SET name=$1,location=$2,street_address=$3,accent=$4,photo=NULL,photo_type=NULL WHERE id=$5',[name,location,address,accent,id]);
 else await db.query('UPDATE shops SET name=$1,location=$2,street_address=$3,accent=$4 WHERE id=$5',[name,location,address,accent,id]); refresh('shop');
}
export async function saveHours(f:FormData) {
 const id=str(f,'shopId'); await shopOwnerAccess(id); const values=Array.from({length:7},(_,d)=>({d,closed:f.has('closed'+d),opens:time(str(f,'opens'+d)),closes:time(str(f,'closes'+d))}));
 if(values.some(v=>!v.closed && v.opens>=v.closes)) throw new Error('Closing time must be after opening time.');
 const c=await db.connect(); try { await c.query('BEGIN'); for(const v of values) await c.query('INSERT INTO shop_hours VALUES($1,$2,$3,$4,$5) ON CONFLICT(shop_id,day) DO UPDATE SET closed=$3,opens=$4,closes=$5',[id,v.d,v.closed,v.opens,v.closes]); await c.query('COMMIT'); } catch(e) {await c.query('ROLLBACK'); throw e;} finally {c.release();} refresh('hours');
}
export async function saveService(f:FormData) {
 const shop=str(f,'shopId'); await shopOwnerAccess(shop); const id=str(f,'id') || randomUUID(); const name=required(str(f,'name')); const description=str(f,'description'); if(description.length>250) throw new Error('Description too long'); const priceText=str(f,'price'); const price=Number(priceText); const duration=Number(str(f,'duration')); if(!/^\d+(\.\d{1,2})?$/.test(priceText)||!Number.isFinite(price)||price<0||price>10000||!Number.isInteger(duration)||duration<1||duration>1440) throw new Error('Invalid price or duration');
 const c=await db.connect();try{await c.query('BEGIN');await c.query('SELECT id FROM shops WHERE id=$1 FOR UPDATE',[shop]);if(str(f,'id')){const staged=await c.query('SELECT coalesce(sum(duration_minutes),0)::int AS minutes FROM salon_service_stages WHERE shop_id=$1 AND service_id=$2',[shop,id]);if(staged.rows[0].minutes&&staged.rows[0].minutes!==duration)throw new Error('Update the duration in Salon settings.');const r=await c.query('UPDATE services SET name=$1,description=$2,price_cents=$3,duration=$4 WHERE id=$5 AND shop_id=$6',[name,description,Math.round(price*100),duration,id,shop]);if(!r.rowCount)throw new Error('Service not found');}else await c.query('INSERT INTO services VALUES($1,$2,$3,$4,$5,$6)',[id,shop,name,description,Math.round(price*100),duration]);await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}refresh('services');refresh('team');refresh('salon');
}
export async function saveBarber(f:FormData) {
 const shop=str(f,'shopId'); const access=await shopOwnerAccess(shop); const existing=str(f,'id'); const id=existing||randomUUID(); const name=required(str(f,'name')); const role=required(str(f,'role')); const ids=f.getAll('services').map(String);
 const shiftValues=f.has('saveShifts')?Array.from({length:7},(_,d)=>({d,off:f.has('off'+d),starts:time(str(f,'starts'+d)),ends:time(str(f,'ends'+d))})):null; if(shiftValues&&(!existing||shiftValues.some(v=>!v.off&&v.starts>=v.ends)))throw new Error('Please check the shift times.');
 const c=await db.connect(); try { await c.query('BEGIN'); const before=existing?null:await planSnapshot(c,shop,true); if(existing) {const r=await c.query('UPDATE barbers SET name=$1,role=$2 WHERE id=$3 AND shop_id=$4',[name,role,id,shop]); if(!r.rowCount) throw new Error('Team member not found');} else {await c.query('INSERT INTO barbers(id,shop_id,name,role) VALUES($1,$2,$3,$4)',[id,shop,name,role]);if(f.has('selfProfile')){if((await c.query('SELECT 1 FROM staff_barber_links WHERE shop_id=$1 AND staff_id=$2',[shop,access.user.id])).rowCount)throw new Error('Your account already has a linked profile.');await c.query('INSERT INTO staff_barber_links(shop_id,staff_id,barber_id) VALUES($1,$2,$3)',[shop,access.user.id,id])}await enforcePlanGrowth(c,shop,before!)}
 await c.query('DELETE FROM barber_services WHERE barber_id=$1 AND shop_id=$2 AND NOT(service_id=ANY($3::text[]))',[id,shop,ids]); for(const service of ids) {const r=await c.query('INSERT INTO barber_services(shop_id,barber_id,service_id) SELECT $1,$2,id FROM services WHERE id=$3 AND shop_id=$1 ON CONFLICT(barber_id,service_id) DO UPDATE SET shop_id=EXCLUDED.shop_id RETURNING service_id',[shop,id,service]); if(!r.rowCount) throw new Error('Service not found');} if(!existing) await c.query("INSERT INTO shifts(shop_id,barber_id,day,off,starts,ends) SELECT $1,$2,d.day,NOT $3 OR coalesce(h.closed,true),CASE WHEN $3 THEN coalesce(h.opens,'09:00'::time) ELSE '09:00'::time END,CASE WHEN $3 THEN coalesce(h.closes,'17:30'::time) ELSE '17:30'::time END FROM generate_series(0,6) AS d(day) LEFT JOIN shop_hours h ON h.shop_id=$1 AND h.day=d.day",[shop,id,f.has('openDays')]); if(shiftValues)for(const v of shiftValues)await c.query('INSERT INTO shifts VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(barber_id,day) DO UPDATE SET off=$4,starts=$5,ends=$6',[shop,id,v.d,v.off,v.starts,v.ends]); await c.query('COMMIT'); } catch(e){await c.query('ROLLBACK');if(e instanceof BookingError)return {error:e.message};throw e;} finally {c.release();} refresh('team');
}
export async function saveShifts(f:FormData) {
 const shop=str(f,'shopId'), id=str(f,'id'); await shopOwnerAccess(shop); const values=Array.from({length:7},(_,d)=>({d,off:f.has('off'+d),starts:time(str(f,'starts'+d)),ends:time(str(f,'ends'+d))})); if(values.some(v=>!v.off&&v.starts>=v.ends)) throw new Error('Shift end must be after start.'); const c=await db.connect(); try {await c.query('BEGIN'); const barber=await c.query('SELECT 1 FROM barbers WHERE id=$1 AND shop_id=$2',[id,shop]); if(!barber.rowCount) throw new Error('Team member not found'); for(const v of values) await c.query('INSERT INTO shifts VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(barber_id,day) DO UPDATE SET off=$4,starts=$5,ends=$6',[shop,id,v.d,v.off,v.starts,v.ends]); await c.query('COMMIT');} catch(e){await c.query('ROLLBACK');throw e;} finally{c.release();} refresh('team');
}
