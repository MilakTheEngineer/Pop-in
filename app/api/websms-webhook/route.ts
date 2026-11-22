import {NextResponse} from 'next/server';
import {recordWebSmsReceipt,verifyWebSmsSignature} from '@/lib/websms-test-delivery';
import {recordSmsDelivery} from '@/lib/sms-reminder-outbox';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const body=await request.text();if(body.length>16384)return new NextResponse(null,{status:413});
 if(!verifyWebSmsSignature(process.env.WEBSMS_SIGNING_SECRET||'',body,request.headers.get('x-websms-timestamp')||'',request.headers.get('x-websms-signature')||''))return new NextResponse(null,{status:401});
 try{const data=JSON.parse(body);if(data.type==='dlr'){
  // Connexus can supply its send ID and a different numeric carrier ID.
  // Match whichever ID was stored from the send response. If the callback
  // arrives first, retain both candidates for reconciliation after the send.
  const ids=[...new Set([data.connexusMessageId,data.messageId].filter((x:unknown)=>typeof x==='string'||typeof x==='number').map((x:unknown)=>String(x)).filter((x:string)=>/^[A-Za-z0-9_-]{1,128}$/.test(x)))];
  const matches=ids.length?await db.query("SELECT provider_id FROM websms_test_reminder WHERE provider_id=ANY($1::text[]) UNION SELECT provider_id FROM sms_reminder_outbox WHERE provider_id=ANY($1::text[])",[ids]):{rows:[]};
  const known=[...new Set(matches.rows.map((row:{provider_id:string})=>row.provider_id))];if(known.length>1)throw new Error('Ambiguous delivery receipt');
  const status=String(data.status||'');for(const id of known.length?known:ids){await recordWebSmsReceipt(String(id),status);await recordSmsDelivery(String(id),status)}
 }return NextResponse.json({ok:true})}catch{return new NextResponse(null,{status:500})}
}
