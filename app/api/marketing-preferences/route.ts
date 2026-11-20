import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/request-origin';
import {BookingError} from '@/lib/booking';
import {bookingPreferences,saveBookingPreferences,unsubscribeInfo,unsubscribe} from '@/lib/retention';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
export async function POST(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers});try{const d=await request.json();if(!d||typeof d!=='object'||Array.isArray(d))throw new BookingError('Invalid request.');const value=d.action==='get'?await bookingPreferences(d.token):d.action==='save'?await saveBookingPreferences(d):d.action==='unsubscribeInfo'?await unsubscribeInfo(d.token):d.action==='unsubscribe'?await unsubscribe(d):null;if(!value)throw new BookingError('Invalid action.');return NextResponse.json(value,{headers})}catch(e){if(e instanceof BookingError)return NextResponse.json({error:e.message},{status:400,headers});console.error('Preference request failed');return NextResponse.json({error:'Could not update your preference.'},{status:500,headers})}}
