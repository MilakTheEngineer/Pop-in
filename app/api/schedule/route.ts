import {sameOrigin} from '@/lib/request-origin';
import {shopAccess,ShopAccessDenied} from '@/lib/auth';
import {BookingError,entries,slots,createBooking,moveBooking,createBlock,setStatus} from '@/lib/booking';
import {NextResponse} from 'next/server';
import {cancelVisitForStaff} from '@/lib/visit';
import {observedBooking} from '@/lib/operator';
import {cancelAppointment} from '@/lib/deposits';
import {previewRecurring,createRecurring} from '@/lib/recurring';
export const dynamic='force-dynamic';
function error(e:unknown){if(e instanceof BookingError) return NextResponse.json({error:e.message},{status:400}); if(e instanceof ShopAccessDenied)return NextResponse.json({error:'Shop access denied.'},{status:403}); if(typeof e==='object'&&e!==null&&'digest' in e&&String(e.digest).startsWith('NEXT_REDIRECT'))return NextResponse.json({error:'Sign in required.'},{status:401}); console.error('Schedule request failed',e);return NextResponse.json({error:'Unable to update the schedule. Please try again.'},{status:500});}
export async function GET(request:Request){try{const p=new URL(request.url).searchParams;const shopId=p.get('shop')||'';await shopAccess(shopId);const date=p.get('date')||'';if(p.get('view')==='slots') return NextResponse.json({slots:await slots({shopId,date,barberId:p.get('barber')||'',serviceId:p.get('service')||'',excludeId:p.get('exclude')||undefined})});return NextResponse.json({entries:await entries(shopId,date)});}catch(e){return error(e)}}
export async function POST(request:Request){try{if(!sameOrigin(request)) return NextResponse.json({error:'Invalid request origin.'},{status:403});const data=await request.json();if(!data||typeof data!=='object'||Array.isArray(data)) throw new BookingError('Invalid request.');const shopId=typeof data.shopId==='string'?data.shopId:'';await shopAccess(shopId);let result;switch(data.action){case 'create':result=await observedBooking(shopId,'staff','create',()=>createBooking(shopId,data));break;case 'previewRepeat':result=await previewRecurring(shopId,data);break;case 'createRepeat':result=await createRecurring(shopId,data);break;case 'move':result=await observedBooking(shopId,'staff','move',()=>moveBooking(shopId,data));break;case 'block':result=await createBlock(shopId,data);break;case 'status':result=data.status==='cancelled'?await cancelAppointment(shopId,String(data.id||'')):await setStatus(shopId,data);break;case 'cancelVisit':result=await cancelVisitForStaff(shopId,String(data.id||''));break;default:throw new BookingError('Invalid action.')}return NextResponse.json(result);}catch(e){return error(e)}}

