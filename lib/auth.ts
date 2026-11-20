import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'crypto';
import { db } from './db';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export class ShopAccessDenied extends Error {}
export async function signIn(staffId: string, shopId?:string) {
  const token = randomBytes(32).toString('hex');
  await db.query("INSERT INTO sessions(id_hash,staff_id,expires_at) VALUES($1,$2,now()+interval '7 days')", [hash(token), staffId]);
  const c=await cookies();c.set('popin_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 604800 });c.delete('popin_shop');if(shopId)c.set('popin_shop',shopId,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:604800});
}
export async function currentStaff() {
  const token = (await cookies()).get('popin_session')?.value;
  if (!token) return null;
  const result = await db.query('SELECT staff.id, staff.name FROM sessions JOIN staff ON staff.id=sessions.staff_id WHERE sessions.id_hash=$1 AND sessions.expires_at > now()', [hash(token)]);
  return result.rowCount ? result.rows[0] as {id:string;name:string} : null;
}
export async function staff() {
  const user=await currentStaff();
  if (!user) redirect('/login');
  return user;
}
export async function shopAccess(shopId?: string) {
  const user = await staff();
  const result = await db.query('SELECT shops.id, shops.name, shops.location, shops.accent, (shops.photo IS NOT NULL) AS has_photo FROM shops JOIN memberships ON memberships.shop_id=shops.id WHERE memberships.staff_id=$1 ORDER BY shops.name', [user.id]);
  if (!result.rowCount) throw new ShopAccessDenied('Shop access denied');
  const selected=shopId??(await cookies()).get('popin_shop')?.value;const match=selected?result.rows.find(r=>r.id===selected):null;const shop=match??(shopId===undefined?result.rows[0]:null);if(!shop)throw new ShopAccessDenied('Shop access denied');
  return { user, shop: shop as {id:string;name:string;location:string;accent:string;has_photo:boolean}, shops: result.rows as {id:string;name:string;location:string}[] };
}

export class ShopOwnerAccessDenied extends Error {}
export async function isShopOwner(staffId:string,shopId:string){const result=await db.query('SELECT 1 FROM shop_owners WHERE staff_id=$1 AND shop_id=$2',[staffId,shopId]);return !!result.rowCount}
export async function shopOwnerAccess(shopId?:string){const access=await shopAccess(shopId);if(!await isShopOwner(access.user.id,access.shop.id))throw new ShopOwnerAccessDenied('Owner access required');return access}
