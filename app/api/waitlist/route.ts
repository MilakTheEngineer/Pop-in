import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/request-origin';
import {confirmationPreview,demoEmailAllowed} from '@/lib/confirmation';
import {BookingError} from '@/lib/booking';
import {publicShop} from '@/lib/guest';
import {joinWaitlist,waitlistStatus,waitlistShopId,claimOffer,declineOffer,leaveWaitlist} from '@/lib/waitlist';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid request.'},{status:403});
 try{const data=await request.json();if(!data||typeof data!=='object'||Array.isArray(data))throw new BookingError('Invalid request.');let result;
 switch(data.action){
  case 'join':{const shop=await publicShop(typeof data.slug==='string'?data.slug:'');if(!shop)throw new BookingError('Shop not found.');if(!confirmationPreview(request,shop.id))return NextResponse.json({error:'The waitlist is unavailable until messaging is configured.'},{status:503});if(!demoEmailAllowed(request,shop.id,data.email))throw new BookingError('Use a fictional @example.test email for this demo.');result=await joinWaitlist(data);break;}
  case 'status':result=await waitlistStatus(data.token);break;
  case 'claim':{const shopId=await waitlistShopId(data.token);if(!confirmationPreview(request,shopId))return NextResponse.json({error:'Booking confirmation is unavailable until messaging is configured.'},{status:503});result=await claimOffer(data.token,data.offerId);break;}
  case 'decline':result=await declineOffer(data.token,data.offerId);break;
  case 'leave':result=await leaveWaitlist(data.token);break;
  default:throw new BookingError('Invalid request.');
 }
 return NextResponse.json(result,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
 }catch(e){if(e instanceof BookingError)return NextResponse.json({error:e.message},{status:400,headers:{'Cache-Control':'no-store'}});console.error('Waitlist request failed');return NextResponse.json({error:'Could not update your waitlist. Please try again.'},{status:500,headers:{'Cache-Control':'no-store'}})}
}
