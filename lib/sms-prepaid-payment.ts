import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {db} from './db';
import {billingStripe,billingConfigured} from './billing-config';
import {appOrigin} from './stripe-test';
import {BookingError} from './booking';

type Pack={priceId:string;amountCents:number;credits:number};
export function smsPrepaidPack():Pack|null{
 if(process.env.POPIN_SMS_TOPUP_ENABLED!=='true'||!billingConfigured())return null;
 const priceId=process.env.POPIN_SMS_TOPUP_PRICE_ID||'',amountCents=Number(process.env.POPIN_SMS_TOPUP_AMOUNT_CENTS),credits=Number(process.env.POPIN_SMS_TOPUP_CREDITS);
 if(!/^price_[A-Za-z0-9_]+$/.test(priceId)||!Number.isSafeInteger(amountCents)||amountCents<1||amountCents>1000000||!Number.isSafeInteger(credits)||credits<1||credits>1000000)return null;
 return {priceId,amountCents,credits};
}
// Stripe test credentials only; no provider calls happen while disabled.
export async function createSmsCheckout(shopId:string){
 const pack=smsPrepaidPack();if(!pack)throw new BookingError('SMS top-ups are unavailable.');
 const stripe=billingStripe(),price=await stripe.prices.retrieve(pack.priceId);
 if(price.livemode||!price.active||price.currency!=='nzd'||price.unit_amount!==pack.amountCents||price.type!=='one_time')throw new BookingError('SMS top-up configuration is unavailable.');
 const id=randomUUID(),origin=appOrigin();await db.query("INSERT INTO sms_credit_purchases(id,shop_id,amount_cents,credits,price_id) VALUES($1,$2,$3,$4,$5)",[id,shopId,pack.amountCents,pack.credits,pack.priceId]);
 const session=await stripe.checkout.sessions.create({mode:'payment',client_reference_id:id,metadata:{sms_order:id,shop_id:shopId},line_items:[{price:pack.priceId,quantity:1}],success_url:origin+'/settings/reminders?topup=return',cancel_url:origin+'/settings/reminders?topup=cancel'}, {idempotencyKey:'sms-topup/'+id});
 let target:URL;try{target=new URL(session.url||'');if(target.protocol!=='https:'||!(target.hostname==='stripe.com'||target.hostname.endsWith('.stripe.com')))throw Error()}catch{throw new BookingError('SMS checkout is unavailable.');}
 if(session.livemode||session.mode!=='payment'||session.client_reference_id!==id)throw new BookingError('SMS checkout is unavailable.');
 await db.query("UPDATE sms_credit_purchases SET checkout_id=$2,state='open' WHERE id=$1 AND state='creating'",[id,session.id]);return {url:target.toString()};
}
export type PaidSession={id:string;livemode:boolean;mode:string|null;payment_status:string;amount_total:number|null;currency:string|null;client_reference_id:string|null;metadata:Record<string,string>|null;payment_intent:string|null};
// Only invoke with a verified provider session retrieved independently of the event.
export async function confirmSmsPayment(q:Pick<PoolClient,'query'>,session:PaidSession){
 if(session.livemode||session.mode!=='payment'||session.payment_status!=='paid'||session.currency!=='nzd'||!session.payment_intent||!session.client_reference_id)return false;
 const order=(await q.query('SELECT * FROM sms_credit_purchases WHERE id=$1 FOR UPDATE',[session.client_reference_id])).rows[0];
 if(!order||order.checkout_id!==session.id||session.metadata?.sms_order!==order.id||session.metadata?.shop_id!==order.shop_id||session.amount_total!==order.amount_cents)return false;
 if(order.state==='paid')return order.payment_id===session.payment_intent;
 if(order.state!=='open')return false;
 await q.query("UPDATE sms_credit_purchases SET state='paid',payment_id=$2,paid_at=now() WHERE id=$1 AND state='open'",[order.id,session.payment_intent]);return true;
}
