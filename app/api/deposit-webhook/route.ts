import {NextResponse} from 'next/server';
import {stripeTest} from '@/lib/stripe-test';
import {handleCheckoutFailure,handleCheckoutSuccess,handleRefundEvent} from '@/lib/deposits';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request:Request){
 const secret=process.env.STRIPE_TEST_WEBHOOK_SECRET||'',signature=request.headers.get('stripe-signature')||'';if(!/^whsec_[A-Za-z0-9_]+$/.test(secret))return new Response('Webhook unavailable',{status:503});
 let body='';try{const reader=request.body?.getReader();if(!reader)throw Error();const parts:Uint8Array[]=[];let total=0;while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>262144){await reader.cancel();throw Error()}parts.push(part.value)}const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}body=new TextDecoder().decode(bytes);}catch{return new Response('Invalid body',{status:400});}
 let event;try{event=stripeTest().webhooks.constructEvent(body,signature,secret)}catch{return new Response('Invalid signature',{status:400})}if(event.livemode)return new Response('Test events only',{status:400});
 try{if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){const session=event.data.object;if(session.metadata?.popin_hold&&session.payment_status==='paid')await handleCheckoutSuccess(session);}else if(event.type==='checkout.session.expired'||event.type==='checkout.session.async_payment_failed')await handleCheckoutFailure(event.data.object);else if(event.type==='refund.updated'||event.type==='refund.created')await handleRefundEvent(event.data.object);return NextResponse.json({received:true},{headers:{'Cache-Control':'no-store'}});}catch{console.error('Test payment event needs retry');return new Response('Please retry',{status:500});}
}

