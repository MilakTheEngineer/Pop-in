import type {PoolClient} from 'pg';
type Query=Pick<PoolClient,'query'>;
// Caller must hold the shop row lock for all balance changes in its transaction.
export async function prepaidBalance(q:Query,shop:string){
 const r=await q.query(`SELECT (coalesce((SELECT sum(credits) FROM sms_credit_purchases WHERE shop_id=$1 AND state='paid'),0)-coalesce((SELECT sum(credits) FROM sms_credit_reservations WHERE shop_id=$1 AND state IN ('reserved','consumed')),0))::int AS balance`,[shop]);return Number(r.rows[0].balance);
}
export async function reservePrepaid(q:Query,shop:string,outbox:string,credits:number){
 if(!Number.isSafeInteger(credits)||credits<1)throw Error('Invalid credit amount');
 await q.query('SELECT id FROM shops WHERE id=$1 FOR UPDATE',[shop]);
 const existing=(await q.query('SELECT shop_id,credits,state FROM sms_credit_reservations WHERE outbox_id=$1 FOR UPDATE',[outbox])).rows[0];
 if(existing&&existing.shop_id!==shop)throw Error('Invalid reservation');
 if(existing&&existing.state!=='released')return existing.credits===credits;
 if(await prepaidBalance(q,shop)<credits)return false;
 await q.query("INSERT INTO sms_credit_reservations(outbox_id,shop_id,credits,state) VALUES($1,$2,$3,'reserved') ON CONFLICT(outbox_id) DO UPDATE SET credits=$3,state='reserved'",[outbox,shop,credits]);return true;
}
export async function settlePrepaid(q:Query,outbox:string,state:'consumed'|'released'){
 await q.query("UPDATE sms_credit_reservations SET state=$2 WHERE outbox_id=$1 AND state='reserved'",[outbox,state]);
}
