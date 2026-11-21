import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/request-origin';
import {confirmationPreview} from '@/lib/confirmation';
import {shopOwnerAccess,ShopAccessDenied,ShopOwnerAccessDenied} from '@/lib/auth';
import {BookingError} from '@/lib/booking';
import {reminderView,saveReminderSettings,runDueReminders,retryReminder} from '@/lib/reminders';
export const dynamic='force-dynamic';
function fail(e:unknown){if(e instanceof BookingError)return NextResponse.json({error:e.message},{status:400});if(e instanceof ShopAccessDenied||e instanceof ShopOwnerAccessDenied)return NextResponse.json({error:'Shop access denied.'},{status:403});if(typeof e==='object'&&e!==null&&'digest' in e&&String(e.digest).startsWith('NEXT_REDIRECT'))return NextResponse.json({error:'Sign in required.'},{status:401});console.error('Reminder request failed',e);return NextResponse.json({error:'Unable to update reminders.'},{status:500});}
export async function GET(request:Request){try{const shop=new URL(request.url).searchParams.get('shop')||'';await shopOwnerAccess(shop);return NextResponse.json(await reminderView(shop),{headers:{'Cache-Control':'no-store'}})}catch(e){return fail(e)}}
export async function POST(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Invalid request.'},{status:403});try{const d=await request.json(),shop=typeof d.shopId==='string'?d.shopId:'';await shopOwnerAccess(shop);let result;if(d.action==='save'){await saveReminderSettings(shop,d);result={ok:true}}else if(d.action==='run'||d.action==='retry'){if(!confirmationPreview(request,shop))return NextResponse.json({error:'Reminder previews are unavailable.'},{status:403});result=d.action==='run'?await runDueReminders(shop,d.simulateFailure===true):await retryReminder(shop,String(d.id||''));}else throw new BookingError('Invalid action.');return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}})}catch(e){return fail(e)}}
