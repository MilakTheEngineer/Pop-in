import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/request-origin';
import {BookingError} from '@/lib/booking';
import {recoveryMessage,requestOwnerRecovery,resetOwnerPassword} from '@/lib/owner-password-recovery';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid request.'},{status:403,headers});
 let data;try{data=await request.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers})}
 if(!data||typeof data!=='object'||Array.isArray(data))return NextResponse.json({error:'Invalid request.'},{status:400,headers});
 if(data.action==='request'){
  try{await requestOwnerRecovery(data.email)}catch{console.error('Owner recovery request could not be completed')}
  return NextResponse.json({ok:true,message:recoveryMessage},{headers});
 }
 if(data.action==='reset'){try{return NextResponse.json(await resetOwnerPassword(data.token,data.password),{headers})}catch(error){if(error instanceof BookingError)return NextResponse.json({error:error.message},{status:400,headers});console.error('Owner password recovery failed');return NextResponse.json({error:'Could not update your password. Please try again.'},{status:500,headers})}}
 return NextResponse.json({error:'Invalid request.'},{status:400,headers});
}
