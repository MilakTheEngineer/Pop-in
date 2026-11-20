import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/request-origin';
import {publicShop} from '@/lib/guest';
import {giftBalance} from '@/lib/commerce';
import {BookingError} from '@/lib/booking';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
export async function POST(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers});try{const d=await request.json(),shop=await publicShop(typeof d.slug==='string'?d.slug:'');if(!shop)throw new BookingError('Shop not found.');return NextResponse.json(await giftBalance(shop.id,d.code),{headers})}catch(e){if(e instanceof BookingError)return NextResponse.json({error:e.message},{status:400,headers});return NextResponse.json({error:'Could not check the balance. Please try again.'},{status:500,headers})}}
