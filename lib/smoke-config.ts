import {createHash,timingSafeEqual} from 'node:crypto';
export const smokeCookie='varello_isolated_smoke';
export function smokeConfig(){
 try{
  const c=JSON.parse(process.env.POPIN_ISOLATED_SMOKE||'null');
  if(!c||!/^smoke-[a-f0-9]{24}$/.test(c.shopId)||!/^[a-f0-9]{64}$/.test(c.secret)||!Number.isFinite(c.expires)||!Array.isArray(c.emails)||c.emails.length!==4||new Set(c.emails).size!==4||!c.emails.every((e:unknown)=>typeof e==='string'&&new RegExp('^(owner|staff|customer|operator)-'+c.shopId+'@example\\.test$').test(e)))return null;
  return c as {shopId:string;secret:string;expires:number;emails:string[]};
 }catch{return null}
}
export function smokeSecretValid(value:unknown){const c=smokeConfig();return !!c&&c.expires>Date.now()&&typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)&&timingSafeEqual(Buffer.from(value),Buffer.from(c.secret))}
export const smokeHash=(value:string)=>createHash('sha256').update(value).digest('hex');
