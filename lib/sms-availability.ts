import {db} from './db';
import {prepaidBalance} from './sms-prepaid-ledger';
import {pilotPublishingEnabled} from './pilot';
import {planSnapshot} from './plan-limits';

export function normalizeSmsPhone(raw:unknown){if(typeof raw!=='string')return '';const n=raw.replace(/[\s().-]/g,'').replace(/^\+/,'').replace(/^0/,'64');return /^642\d{7,9}$/.test(n)?n:''}
export async function smsConfigured(shopId:string){
 const cap=Number(process.env.WEBSMS_PILOT_MAX_PARTS||0);
 if(process.env.WEBSMS_CUSTOMER_ENABLED!=='true'||!Number.isSafeInteger(cap)||cap<1||!process.env.WEBSMS_CLIENT_ID||!process.env.WEBSMS_CLIENT_SECRET||!process.env.WEBSMS_SIGNING_SECRET||!await pilotPublishingEnabled(shopId))return false;
 const plan=await planSnapshot(db,shopId);
 return Boolean(plan.plan.smsSegments||await prepaidBalance(db,shopId)>0||(await db.query("SELECT 1 FROM sms_credit_reservations WHERE shop_id=$1 AND state='reserved' LIMIT 1",[shopId])).rowCount);
}
export async function smsPublicAvailable(shopId:string){
 if(!await smsConfigured(shopId))return false;
 const setting=await db.query("SELECT 1 FROM reminder_settings WHERE shop_id=$1 AND enabled AND channel='sms'",[shopId]);
 return Boolean(setting.rowCount);
}
