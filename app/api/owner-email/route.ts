import {NextResponse} from 'next/server';
import {shopOwnerAccess,ShopAccessDenied,ShopOwnerAccessDenied} from '@/lib/auth';
import {sameOrigin} from '@/lib/request-origin';
import {BookingError} from '@/lib/booking';
import {consumeOwnerVerification,issueOwnerVerification,ownerEmailState} from '@/lib/owner-email-verification';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
function fail(error:unknown){
 if(error instanceof BookingError)return NextResponse.json({error:error.message},{status:400,headers});
 if(error instanceof ShopAccessDenied||error instanceof ShopOwnerAccessDenied)return NextResponse.json({error:'Owner access required.'},{status:403,headers});
 if(typeof error==='object'&&error!==null&&'digest' in error&&String(error.digest).startsWith('NEXT_REDIRECT'))return NextResponse.json({error:'Sign in required.'},{status:401,headers});
 console.error('Owner email verification failed');return NextResponse.json({error:'Could not verify email. Please try again.'},{status:500,headers});
}
export async function GET(){try{const {user}=await shopOwnerAccess();return NextResponse.json(await ownerEmailState(user.id),{headers})}catch(error){return fail(error)}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers});
 try{const data=await request.json();if(!data||typeof data!=='object'||Array.isArray(data))throw new BookingError('Invalid request.');
  if(data.action==='verify')return NextResponse.json(await consumeOwnerVerification(data.token),{headers});
  if(data.action==='send'){const {user}=await shopOwnerAccess();return NextResponse.json(await issueOwnerVerification(user.id),{headers});}
  throw new BookingError('Invalid request.');
 }catch(error){return fail(error)}
}
