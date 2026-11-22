import {NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {sameOrigin} from '@/lib/request-origin';
import {createOwnerShop} from '@/lib/onboarding';
import {signIn} from '@/lib/auth';

export const dynamic='force-dynamic';
export async function POST(request:Request){
 const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
 if(!sameOrigin(request))return reply({error:'Invalid request.'},403);
 try{
  const data=await request.json();
  const expected=process.env.POPIN_OWNER_BOOTSTRAP_HASH||'',expiry=Number(process.env.POPIN_OWNER_BOOTSTRAP_EXPIRES||0),email=process.env.POPIN_OWNER_BOOTSTRAP_EMAIL||'';
  const actual=createHash('sha256').update(typeof data.token==='string'?data.token:'').digest('hex');
  if(!/^[a-f0-9]{64}$/.test(expected)||Date.now()>expiry||!email||!timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))return reply({error:'This private setup link is invalid or expired.'},403);
  const result=await createOwnerShop({name:'Mika',email,password:data.password,shopName:'Private test shop',location:'Rotorua',streetAddress:'1 Example Street'});
  await signIn(result.userId,result.shopId);
  return reply({ok:true});
 }catch{return reply({error:'Could not complete setup. The link may have been used already, or the password needs at least 8 characters.'},400)}
}
