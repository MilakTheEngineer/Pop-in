import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/request-origin';
import {localConfirmationPreview} from '@/lib/confirmation';
import {BookingError} from '@/lib/booking';
import {testConversation,testIncoming} from '@/lib/retention';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
export async function POST(request:Request){if(!sameOrigin(request)||!localConfirmationPreview(request))return NextResponse.json({error:'Test messaging is available only on this development computer.'},{status:403,headers});try{const d=await request.json();if(!d||typeof d!=='object'||Array.isArray(d))throw new BookingError('Invalid request.');const result=d.action==='conversation'?await testConversation(d.token):d.action==='reply'?await testIncoming(d):null;if(!result)throw new BookingError('Invalid action.');return NextResponse.json(result,{headers})}catch(e){if(e instanceof BookingError)return NextResponse.json({error:e.message},{status:400,headers});console.error('Test message request failed');return NextResponse.json({error:'Could not update the test conversation.'},{status:500,headers})}}
