import {sameOrigin} from '@/lib/request-origin';
import {observedBooking} from '@/lib/operator';
import {NextResponse} from 'next/server';
import {shopAccess,ShopAccessDenied} from '@/lib/auth';
import {BookingError} from '@/lib/booking';
import {queueView,joinQueue,callNext,seatQueue,leaveQueue,setDelay} from '@/lib/queue';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
function fail(e:unknown){if(e instanceof BookingError)return NextResponse.json({error:e.message},{status:400});if(e instanceof ShopAccessDenied)return NextResponse.json({error:'Shop access denied.'},{status:403});if(typeof e==='object'&&e!==null&&'digest' in e&&String(e.digest).startsWith('NEXT_REDIRECT'))return NextResponse.json({error:'Sign in required.'},{status:401});console.error('Staff queue request failed',e);return NextResponse.json({error:'Unable to update the queue.'},{status:500});}
export async function GET(request:Request){try{const shopId=new URL(request.url).searchParams.get('shop')||'';await shopAccess(shopId);return NextResponse.json(await queueView(shopId),{headers:{'Cache-Control':'no-store'}})}catch(e){return fail(e)}}
export async function POST(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Invalid request.'},{status:403});try{const d=await request.json();const shopId=typeof d.shopId==='string'?d.shopId:'';await shopAccess(shopId);let result;switch(d.action){case 'join':result=await joinQueue(shopId,d);break;case 'pause':if(typeof d.paused!=='boolean')throw new BookingError('Invalid queue state.');await db.query('UPDATE shops SET queue_paused=$1 WHERE id=$2',[d.paused,shopId]);result={ok:true};break;case 'call':result=await callNext(shopId,d.requestKey);break;case 'seat':result=await observedBooking(shopId,'queue','seat',()=>seatQueue(shopId,String(d.id||'')));break;case 'left':result=await leaveQueue(shopId,String(d.id||''));break;case 'delay':result=await setDelay(shopId,String(d.barberId||''),d.minutes);break;default:throw new BookingError('Invalid action.')}return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}})}catch(e){return fail(e)}}
