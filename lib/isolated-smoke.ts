import {cookies} from 'next/headers';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import type {PoolClient} from 'pg';
import {db} from './db';
import {smokeConfig,smokeCookie,smokeSecretValid} from './smoke-config';
type Query=Pick<PoolClient,'query'>;
export async function smokeCapability(){try{return smokeSecretValid((await cookies()).get(smokeCookie)?.value)}catch{return false}}
export async function smokeShop(shopId:string,q:Query=db){return (await q.query('SELECT * FROM isolated_smoke WHERE shop_id=$1',[shopId])).rows[0]}
export async function smokeAccess(shopId:string,q:Query=db){
 const fixture=await smokeShop(shopId,q),cap=await smokeCapability();
 if(!fixture)return !cap; // A fixture browser cannot act on ordinary shops.
 return cap&&smokeConfig()?.shopId===shopId&&!fixture.closed_at&&new Date(fixture.expires_at).getTime()>Date.now();
}
export async function smokeIdentityAccess(staffId:string,q:Query=db){
 const r=await q.query('SELECT f.shop_id FROM isolated_smoke f JOIN staff u ON u.email=ANY(f.emails) WHERE u.id=$1',[staffId]);
 return r.rowCount?await smokeAccess(r.rows[0].shop_id,q):!await smokeCapability();
}
function captureKey(){const c=smokeConfig();if(!c)throw Error('Fixture capture unavailable');return Buffer.from(c.secret,'hex')}
export function encryptSmoke(value:unknown){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',captureKey(),iv);const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64')}
export function decryptSmoke(value:string,kind:string){const raw=Buffer.from(value,'base64'),key=kind==='booking'?Buffer.from(process.env.POPIN_BOOKING_EMAIL_KEY||'','base64'):captureKey();const decipher=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decipher.setAuthTag(raw.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString())}
export async function captureSmokeAccount(message:{to:string;subject:string;text:string;idempotencyKey:string}){
 const fixture=(await db.query('SELECT * FROM isolated_smoke WHERE $1=ANY(emails)',[message.to.toLowerCase()])).rows[0];
 if(!fixture)return false;
 // Always suppress, including after closure/expiry/config removal. Never fall through.
 if(!fixture.closed_at&&new Date(fixture.expires_at).getTime()>Date.now()&&smokeConfig()?.shopId===fixture.shop_id){
  await db.query("INSERT INTO isolated_smoke_capture(shop_id,event_key,kind,payload_ciphertext) VALUES($1,$2,'account',$3) ON CONFLICT(event_key) DO NOTHING",[fixture.shop_id,message.idempotencyKey,encryptSmoke(message)]);
 }
 return true;
}
