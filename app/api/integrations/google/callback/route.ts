import {NextResponse} from 'next/server';
import {currentStaff} from '@/lib/auth';
import {finishGoogle} from '@/lib/calendar';
import {googleCalendarConfig} from '@/lib/calendar-provider';
export const dynamic='force-dynamic';
export async function GET(request:Request){const cfg=googleCalendarConfig();if(!cfg)return new NextResponse('Google Calendar is not configured.',{status:503,headers:{'Cache-Control':'no-store'}});const base=new URL(cfg.redirect).origin,target=new URL('/settings/integrations',base),url=new URL(request.url),user=await currentStaff();if(!user)return new NextResponse('Please sign in and start the calendar connection again.',{status:401,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});try{const shop=await finishGoogle(url.searchParams.get('state')||'',url.searchParams.get('code')||'',user.id);target.searchParams.set('shop',shop);target.searchParams.set('calendar','connected')}catch{target.searchParams.set('calendar','failed')}return NextResponse.redirect(target,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})}
