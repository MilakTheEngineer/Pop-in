import {NextResponse} from 'next/server';
import {recordWebSmsReceipt,verifyWebSmsSignature} from '@/lib/websms-test-delivery';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const body=await request.text();if(body.length>16384)return new NextResponse(null,{status:413});
 if(!verifyWebSmsSignature(process.env.WEBSMS_SIGNING_SECRET||'',body,request.headers.get('x-websms-timestamp')||'',request.headers.get('x-websms-signature')||''))return new NextResponse(null,{status:401});
 try{const data=JSON.parse(body);if(data.type==='dlr')await recordWebSmsReceipt(String(data.connexusMessageId||data.messageId||''),String(data.status||''));return NextResponse.json({ok:true})}catch{return new NextResponse(null,{status:400})}
}
