import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/request-origin';
import {localConfirmationPreview,hostedOwnerSetupPreview} from '@/lib/confirmation';
import {shopAccess,isShopOwner,ShopAccessDenied} from '@/lib/auth';
import {BookingError} from '@/lib/booking';
import {inboxView,inboxAction,addInboxSamples} from '@/lib/retention';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
function fail(e:unknown){if(e instanceof BookingError)return NextResponse.json({error:e.message},{status:400,headers});if(e instanceof ShopAccessDenied)return NextResponse.json({error:'Shop access denied.'},{status:403,headers});if(typeof e==='object'&&e!==null&&'digest'in e&&String(e.digest).startsWith('NEXT_REDIRECT'))return NextResponse.json({error:'Sign in required.'},{status:401,headers});console.error('Inbox request failed');return NextResponse.json({error:'Could not update the inbox.'},{status:500,headers})}
export async function GET(request:Request){try{const p=new URL(request.url).searchParams,shop=p.get('shop')||'';await shopAccess(shop);return NextResponse.json(await inboxView(shop,p.get('thread')||undefined),{headers})}catch(e){return fail(e)}}
export async function POST(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers});try{const d=await request.json();if(!d||typeof d!=='object'||Array.isArray(d))throw new BookingError('Invalid request.');const shop=typeof d.shopId==='string'?d.shopId:'',{user}=await shopAccess(shop);if(d.action==='addSamples'){if(!(localConfirmationPreview(request)||hostedOwnerSetupPreview(request))||!await isShopOwner(user.id,shop))throw new ShopAccessDenied();return NextResponse.json(await addInboxSamples(shop),{headers})}return NextResponse.json(await inboxAction(shop,user.id,d,localConfirmationPreview(request)),{headers})}catch(e){return fail(e)}}
