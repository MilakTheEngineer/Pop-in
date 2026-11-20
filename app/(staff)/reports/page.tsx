import {notFound} from 'next/navigation';
import {shopOwnerAccess,ShopAccessDenied,ShopOwnerAccessDenied} from '@/lib/auth';
import {todayNZ} from '@/lib/booking';
import {dailyReport} from '@/lib/reports';
import {DailyClose} from './workspace';
import './daily-report.css';
export const dynamic='force-dynamic';
export default async function Reports(){const access=await shopOwnerAccess().catch(e=>{if(e instanceof ShopAccessDenied||e instanceof ShopOwnerAccessDenied)notFound();throw e});const report=await dailyReport(access.shop.id,todayNZ());return <DailyClose initial={report}/>}
