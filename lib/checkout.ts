import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {db} from './db';
import {BookingError,todayNZ} from './booking';
import {commerceSummary,commitCommerce,finishCommerce} from './commerce';

type Query=Pick<PoolClient,'query'>;
type Payment={id:string;kind:'payment'|'refund';purpose:string;amount_cents:number;tender:string|null;fee_cents:number|null;original_payment_id:string|null;occurred_at:Date;receipt_id:string|null};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
function amount(v:unknown,allowZero=false){if(typeof v!=='string'||!/^\d{1,5}(?:\.\d{1,2})?$/.test(v))throw new BookingError('Enter a valid NZD amount.');const [whole,decimal='']=v.split('.'),n=Number(whole)*100+Number((decimal+'00').slice(0,2));if(n<(allowZero?0:1)||n>1000000)throw new BookingError('Enter an amount within the allowed range.');return n;}
function name(v:unknown){return typeof v==='string'&&v.length<=120?v:''}

async function appointment(q:Query,shopId:string,entryId:string,lock=false){
 const r=await q.query(`SELECT e.id,e.shop_id,e.customer_name,e.service_name,e.duration_minutes,e.starts_at,e.status,e.onboarding_test,b.name AS barber_name,s.name AS shop_name,s.location,coalesce(g.price_cents,v.price_cents,e.price_cents_snapshot) AS price_cents,t.start_date::text AS tracking_start,d.id AS deposit_hold_id,d.deposit_cents,d.state AS deposit_state FROM schedule_entries e JOIN shops s ON s.id=e.shop_id JOIN barbers b ON b.id=e.barber_id AND b.shop_id=e.shop_id LEFT JOIN guest_booking_links g ON g.entry_id=e.id LEFT JOIN guest_visit_people v ON v.entry_id=e.id AND v.shop_id=e.shop_id LEFT JOIN shop_payment_tracking t ON t.shop_id=e.shop_id LEFT JOIN deposit_holds d ON d.booking_entry_id=e.id AND d.shop_id=e.shop_id WHERE e.id=$1 AND e.shop_id=$2 AND e.kind='appointment'${lock?' FOR UPDATE OF e':''}`,[entryId,shopId]);
 if(!r.rowCount||r.rows[0].onboarding_test)throw new BookingError('Appointment not found.');return r.rows[0];
}
async function ledger(q:Query,shopId:string,entryId:string,test:boolean):Promise<Payment[]>{
 const table=test?'checkout_test_entries':'payment_entries',receiptColumn=test?'test_payment_id':'payment_id';
 return (await q.query(`SELECT p.id,p.kind,p.purpose,p.amount_cents,p.tender,p.fee_cents,p.original_payment_id,p.occurred_at,r.id AS receipt_id FROM ${table} p LEFT JOIN checkout_receipts r ON r.${receiptColumn}=p.id AND r.shop_id=p.shop_id AND r.entry_id=p.entry_id WHERE p.shop_id=$1 AND p.entry_id=$2 ORDER BY p.occurred_at,p.id`,[shopId,entryId])).rows;
}
function compute(b:Record<string,any>,payments:Payment[],commerce:Awaited<ReturnType<typeof commerceSummary>>=null){
 const test=!!b.deposit_hold_id,deposit=test&&b.deposit_state==='paid'?Number(b.deposit_cents):0;
 const net=payments.reduce((sum,p)=>sum+(p.kind==='payment'?p.amount_cents:-p.amount_cents),0);
 const unlinked=payments.filter(p=>p.kind==='refund'&&!p.original_payment_id).reduce((sum,p)=>sum+p.amount_cents,0);
 const transactions=payments.map(p=>{const linked=payments.filter(r=>r.kind==='refund'&&r.original_payment_id===p.id).reduce((sum,r)=>sum+r.amount_cents,0);return {...p,refundable_cents:p.kind==='payment'&&p.tender?Math.min(Math.max(0,p.amount_cents-linked-unlinked),Math.max(0,net)):0}});
 const deposits=payments.filter(p=>p.kind==='payment'&&p.purpose==='deposit').reduce((sum,p)=>sum+p.amount_cents,0)-payments.filter(p=>p.kind==='refund'&&p.purpose==='deposit').reduce((sum,p)=>sum+p.amount_cents,0);
 return {test,deposit,net,unlinked,transactions,deposits,balance:b.price_cents===null?null:commerce?.status==='refunded'?0:Math.max(0,Number(b.price_cents)+(commerce?.extraCents||0)-(commerce?.creditCents||0)-deposit-net)};
}
export async function checkoutView(shopId:string,entryId:string,q:Query=db){const b=await appointment(q,shopId,entryId),test=!!b.deposit_hold_id,transactions=await ledger(q,shopId,entryId,test),commerce=test?null:await commerceSummary(q,shopId,entryId),c=compute(b,transactions,commerce),realLedger=test?await ledger(q,shopId,entryId,false):[],manualLedgerConflictCents=realLedger.reduce((n,p)=>n+(p.kind==='payment'?p.amount_cents:-p.amount_cents),0);return {appointment:{id:b.id,customerName:b.customer_name,serviceName:b.service_name,duration:b.duration_minutes,barberName:b.barber_name,startsAt:b.starts_at.toISOString(),status:b.status,priceCents:b.price_cents,shopName:b.shop_name,location:b.location},trackingStart:b.tracking_start,mode:test?'test':'manual',testDepositCents:c.deposit,testDepositState:b.deposit_state,manualLedgerConflictCents,recordedDepositCents:c.deposits,otherRecordedCents:c.net-c.deposits,balanceCents:c.balance,unallocatedRefundCents:c.unlinked,commerce,transactions:c.transactions.map(p=>({...p,occurred_at:p.occurred_at.toISOString()}))};}

function receiptSnapshot(b:Record<string,any>,p:Payment,before:number,after:number|null,test:boolean,deposit:number,commerce:Awaited<ReturnType<typeof commerceSummary>>){return {mode:test?'test':'manual',shopName:b.shop_name,location:b.location,customerName:b.customer_name,barberName:b.barber_name,serviceName:b.service_name,startsAt:b.starts_at.toISOString(),priceCents:b.price_cents,depositCents:deposit,paidBeforeCents:before,amountCents:p.amount_cents,tender:p.tender,kind:p.kind,feeCents:p.fee_cents,originalPaymentId:p.original_payment_id,occurredAt:p.occurred_at.toISOString(),balanceAfterCents:after,items:commerce?.lines||[],creditCents:commerce?.creditCents||0};}
async function ensureReceipt(q:Query,b:Record<string,any>,p:Payment,test:boolean,all:Payment[]){
 const column=test?'test_payment_id':'payment_id';const found=(await q.query(`SELECT id FROM checkout_receipts WHERE ${column}=$1 AND shop_id=$2 AND entry_id=$3`,[p.id,b.shop_id,b.id])).rows[0];if(found)return found.id as string;
 const commerce=test?null:await commerceSummary(q,b.shop_id,b.id),index=all.findIndex(x=>x.id===p.id),beforeRows=all.slice(0,index),afterRows=all.slice(0,index+1),before=compute(b,beforeRows,commerce),after=compute(b,afterRows,commerce),id=randomUUID();
 await q.query(`INSERT INTO checkout_receipts(id,shop_id,entry_id,${column},snapshot) VALUES($1,$2,$3,$4,$5)`,[id,b.shop_id,b.id,p.id,receiptSnapshot(b,p,before.net,after.balance,test,before.deposit,commerce)]);return id;
}
export async function issueCheckoutReceipt(shopId:string,entryId:string,transactionId:string){const q=await db.connect();try{await q.query('BEGIN');const b=await appointment(q,shopId,entryId,true),test=!!b.deposit_hold_id,all=await ledger(q,shopId,entryId,test),p=all.find(x=>x.id===transactionId);if(!p)throw new BookingError('Payment not found.');const id=await ensureReceipt(q,b,p,test,all);await q.query('COMMIT');return {receiptId:id};}catch(e){await q.query('ROLLBACK');throw e}finally{q.release()}}

export async function recordCheckout(shopId:string,userId:string,data:Record<string,unknown>,owner:boolean){
 const id=data.id,entryId=name(data.entryId),action=data.action,tender=data.tender;
 if(!uuid(id)||!entryId||!['payment','refund'].includes(String(action)))throw new BookingError('Please check the checkout details.');
 if(action==='refund'&&!owner)throw new BookingError('Only a shop owner can record a refund.');
 if(action==='payment'&&(!['cash','card'].includes(String(tender))||!['balance','deposit'].includes(String(data.purpose))))throw new BookingError('Select cash or external EFTPOS and a payment type.');
 const purpose=action==='payment'&&data.purpose==='deposit'?'deposit':'balance',value=amount(data.amount),fee=data.fee===''||data.fee===undefined||data.fee===null?(tender==='cash'?0:null):amount(data.fee,true),original=action==='refund'?name(data.originalPaymentId):null;
 if(action==='refund'&&!original)throw new BookingError('Select the original payment to refund.');
 const q=await db.connect();try{await q.query('BEGIN');const b=await appointment(q,shopId,entryId,true),test=!!b.deposit_hold_id,all=await ledger(q,shopId,entryId,test),existing=all.find(p=>p.id===id),commerce=test?null:await commerceSummary(q,shopId,entryId),c=compute(b,all,commerce);
  // The transaction id is stable across uncertain responses, including a reload.
  if(existing){const parent=action==='refund'?all.find(p=>p.id===original):null;const expectedTender=parent?.tender??tender;if(existing.kind!==action||existing.amount_cents!==value||existing.tender!==expectedTender||existing.tender!==tender||existing.fee_cents!==fee||existing.original_payment_id!==original||(action==='payment'&&existing.purpose!==purpose))throw new BookingError('This request was already used with different details.');const receiptId=await ensureReceipt(q,b,existing,test,all);await q.query('COMMIT');return {receiptId,replayed:true};}
  const used=(await q.query('SELECT 1 FROM payment_entries WHERE id=$1 UNION ALL SELECT 1 FROM checkout_test_entries WHERE id=$1',[id])).rowCount;if(used)throw new BookingError('This request was already used with different details.');
  if(test){const real=await ledger(q,shopId,entryId,false);if(real.reduce((n,p)=>n+(p.kind==='payment'?p.amount_cents:-p.amount_cents),0)!==0)throw new BookingError('This test appointment also has a real manual ledger balance. Ask an owner to review it in Reports before using test checkout.');}
  if(!test&&(!b.tracking_start||todayNZ()<b.tracking_start))throw new BookingError('An owner needs to start manual payment tracking in Reports first.');
  if(test&&!['paid','refunded'].includes(b.deposit_state))throw new BookingError('The test deposit is still being reconciled. Try again when its status is final.');
  if(b.price_cents===null)throw new BookingError('The agreed service price is unavailable for this appointment.');
  let paymentTender=tender,paymentPurpose=purpose;
  if(action==='payment'){if(!['booked','completed'].includes(b.status))throw new BookingError('Only booked or completed appointments can receive a payment.');if(c.balance===null||value>c.balance||purpose==='balance'&&value!==c.balance)throw new BookingError('The balance changed. Refresh checkout and check the amount.');}
  else{if(commerce)throw new BookingError('Use Refund whole sale to restore stock and prepaid balances together.');const parent=c.transactions.find(p=>p.id===original&&p.kind==='payment');if(!parent||!parent.tender)throw new BookingError('The original payment or its tender is unavailable.');if(tender!==parent.tender)throw new BookingError('The refund must use the original payment method.');if(value>parent.refundable_cents)throw new BookingError('The refund exceeds the amount available on the original payment.');paymentTender=parent.tender;paymentPurpose=parent.purpose;}
  if(action==='payment'&&commerce&&(purpose==='balance'||value===c.balance))await commitCommerce(q,shopId,entryId,userId);
  const table=test?'checkout_test_entries':'payment_entries',inserted=(await q.query(`INSERT INTO ${table}(id,shop_id,entry_id,kind,purpose,amount_cents,tender,fee_cents,original_payment_id,occurred_at,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp(),$10) RETURNING occurred_at`,[id,shopId,entryId,action,paymentPurpose,value,paymentTender,fee,original,userId])).rows[0];
  const created:Payment={id,kind:action as 'payment'|'refund',purpose:paymentPurpose,amount_cents:value,tender:paymentTender as string,fee_cents:fee,original_payment_id:original,occurred_at:inserted.occurred_at,receipt_id:null};if(action==='payment'&&commerce)await finishCommerce(q,shopId,entryId,userId,compute(b,[...all,created],commerce).balance??-1);const receiptId=await ensureReceipt(q,b,created,test,[...all,created]);await q.query('COMMIT');return {receiptId,replayed:false};
 }catch(e){await q.query('ROLLBACK');throw e}finally{q.release()}
}
export async function checkoutReceipt(shopId:string,id:string){const r=await db.query('SELECT id,entry_id,snapshot FROM checkout_receipts WHERE id=$1 AND shop_id=$2',[id,shopId]);if(!r.rowCount)throw new BookingError('Receipt not found.');return r.rows[0];}
