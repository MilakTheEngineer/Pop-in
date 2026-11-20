import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import type {PoolClient} from 'pg';
import {db} from './db';
type Query=Pick<PoolClient,'query'>;
export type DirectorySelection={shopId:string;slug:string;serviceId:string;barberId:string;date:string;time:string;priceCents:number;expires:number;nonce:string};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const newDirectorySecret=()=>randomBytes(32).toString('hex');
export function signDirectorySelection(selection:DirectorySelection,secret:string){const body=Buffer.from(JSON.stringify(selection)).toString('base64url');const sig=createHmac('sha256',secret).update(body).digest('hex');return body+'.'+sig}
export async function verifyDirectorySelection(value:unknown,shopId?:string,q:Query=db){
 if(typeof value!=='string'||value.length>2048)return null;const pieces=value.split('.');if(pieces.length!==2||!/^[A-Za-z0-9_-]+$/.test(pieces[0])||!/^[0-9a-f]{64}$/.test(pieces[1]))return null;
 let payload:DirectorySelection;try{payload=JSON.parse(Buffer.from(pieces[0],'base64url').toString('utf8'))}catch{return null}
 if(!payload||typeof payload.shopId!=='string'||typeof payload.slug!=='string'||typeof payload.serviceId!=='string'||typeof payload.barberId!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)||!/^\d{2}:\d{2}$/.test(payload.time)||!Number.isInteger(payload.priceCents)||payload.priceCents<0||!Number.isSafeInteger(payload.expires)||payload.expires<=Date.now()||typeof payload.nonce!=='string'||!/^[a-f0-9]{32}$/.test(payload.nonce)||shopId&&payload.shopId!==shopId)return null;
 const row=(await q.query('SELECT p.referral_secret,s.public_slug,s.booking_published FROM directory_profiles p JOIN shops s ON s.id=p.shop_id WHERE p.shop_id=$1',[payload.shopId])).rows[0];if(!row||!row.booking_published||row.public_slug!==payload.slug)return null;const expected=createHmac('sha256',row.referral_secret).update(pieces[0]).digest();const supplied=Buffer.from(pieces[1],'hex');if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return null;return payload;
}
export async function directorySelectionHash(q:Query,shopId:string,value:unknown){return await verifyDirectorySelection(value,shopId,q)?hash(value as string):null}
export async function recordDirectoryBooking(q:Query,shopId:string,entryId:string,selectionHash:string|null){if(selectionHash)await q.query('INSERT INTO directory_bookings(entry_id,shop_id,selection_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[entryId,shopId,selectionHash])}
