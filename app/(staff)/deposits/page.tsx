import {notFound} from 'next/navigation';
import {shopOwnerAccess,ShopAccessDenied,ShopOwnerAccessDenied} from '@/lib/auth';
import {depositSettings} from '@/lib/deposit-settings';
import {stripeConfigured} from '@/lib/stripe-test';
import {db} from '@/lib/db';
import {DepositWorkspace} from './workspace';
import './deposits.css';
export const dynamic='force-dynamic';
export default async function Deposits(){const access=await shopOwnerAccess().catch(e=>{if(e instanceof ShopAccessDenied||e instanceof ShopOwnerAccessDenied)notFound();throw e});const settings=await depositSettings(access.shop.id),refunds=(await db.query("SELECT id,customer_name,deposit_cents,state FROM deposit_holds WHERE shop_id=$1 AND state IN ('refund_pending','refund_failed') ORDER BY updated_at DESC LIMIT 50",[access.shop.id])).rows;return <DepositWorkspace shopId={access.shop.id} initial={{...settings,configured:stripeConfigured(),refunds}}/>}
