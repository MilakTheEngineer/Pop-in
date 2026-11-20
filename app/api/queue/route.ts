import {sameOrigin} from '@/lib/request-origin';
import {NextResponse} from 'next/server';
import {publicShop} from '@/lib/guest';
import {BookingError} from '@/lib/booking';
import {joinQueue,queueByToken,leaveWithToken} from '@/lib/queue';
export const dynamic='force-dynamic';
export async function POST(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Invalid request.'},{status:403});try{const d=await request.json();let result;if(d.action==='join'){const shop=await publicShop(typeof d.slug==='string'?d.slug:'');if(!shop)throw new BookingError('Shop not found.');const q=await joinQueue(shop.id,d);result={token:q.token};}else if(d.action==='status')result={entry:await queueByToken(d.token)};else if(d.action==='leave')result=await leaveWithToken(d.token);else throw new BookingError('Invalid request.');return NextResponse.json(result,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}})}catch(e){if(e instanceof BookingError)return NextResponse.json({error:e.message},{status:400,headers:{'Cache-Control':'no-store'}});console.error('Queue request failed');return NextResponse.json({error:'Unable to update the queue. Please try again.'},{status:500})}}
