import {NextResponse} from 'next/server';
import {operatorAccess} from '@/lib/operator';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){const auth=await operatorAccess();if(auth.status!=='allowed')return NextResponse.json({error:'Operator access required.'},{status:403,headers:{'Cache-Control':'no-store'}});try{const r=await db.query('SELECT r.id,r.screen,r.category,r.message,r.reply_email,r.created_at,s.name AS founder_shop,s.location AS founder_location FROM support_reports r LEFT JOIN shops s ON s.id=r.founder_shop_id ORDER BY r.created_at DESC LIMIT 200');return NextResponse.json({reports:r.rows},{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}})}catch{return NextResponse.json({error:'Could not load support reports.'},{status:500,headers:{'Cache-Control':'no-store'}})}}
