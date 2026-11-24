import {NextResponse} from 'next/server';
import {shopOwnerAccess} from '@/lib/auth';
import {sameOrigin} from '@/lib/request-origin';
import {createSmsCheckout,smsPrepaidOffer} from '@/lib/sms-prepaid-payment';
import {prepaidBalance} from '@/lib/sms-prepaid-ledger';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const shop=new URL(request.url).searchParams.get('shop')||'';await shopOwnerAccess(shop);const pack=await smsPrepaidOffer();return NextResponse.json({pack:pack?{amountCents:pack.amountCents,credits:pack.credits}:null,balance:await prepaidBalance(db,shop)},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Unavailable'},{status:403})}}
export async function POST(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Unavailable'},{status:403});try{const d=await request.json();const shop=typeof d.shopId==='string'?d.shopId:'';await shopOwnerAccess(shop);return NextResponse.json(await createSmsCheckout(shop),{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'SMS checkout is unavailable.'},{status:403})}}
