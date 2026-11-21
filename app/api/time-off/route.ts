import {NextResponse} from 'next/server';
import {shopAccess,isShopOwner,ShopAccessDenied} from '@/lib/auth';
import {sameOrigin} from '@/lib/request-origin';
import {BookingError} from '@/lib/booking';
import {timeOffView,timeOffAction,TimeOffConflict} from '@/lib/time-off';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
function fail(e:unknown){if(e instanceof TimeOffConflict)return NextResponse.json({error:e.message,appointments:e.appointments},{status:409,headers});if(e instanceof BookingError)return NextResponse.json({error:e.message},{status:400,headers});if(e instanceof ShopAccessDenied)return NextResponse.json({error:'Shop access denied.'},{status:403,headers});if(typeof e==='object'&&e!==null&&'digest'in e&&String(e.digest).startsWith('NEXT_REDIRECT'))return NextResponse.json({error:'Sign in required.'},{status:401,headers});console.error('Time off request failed',e);return NextResponse.json({error:'Could not update time off. Please try again.'},{status:500,headers})}
export async function GET(request:Request){try{const shop=new URL(request.url).searchParams.get('shop')||'',{user}=await shopAccess(shop),owner=await isShopOwner(user.id,shop);return NextResponse.json(await timeOffView(shop,user.id,owner),{headers})}catch(e){return fail(e)}}
export async function POST(request:Request){try{if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers});const d=await request.json();if(!d||typeof d!=='object'||Array.isArray(d))throw new BookingError('Invalid request.');const shop=typeof d.shopId==='string'?d.shopId:'',{user}=await shopAccess(shop),owner=await isShopOwner(user.id,shop);return NextResponse.json(await timeOffAction(shop,user.id,owner,d),{headers})}catch(e){return fail(e)}}
