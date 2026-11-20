import {notFound} from 'next/navigation';
import {shopOwnerAccess,ShopAccessDenied,ShopOwnerAccessDenied} from '@/lib/auth';
import {teamView,earningsView,week} from '@/lib/team';
import {EarningsWorkspace} from './workspace';
import '../commerce.css';
import '../team/team.css';
export const dynamic='force-dynamic';
export default async function EarningsPage({searchParams}:{searchParams:Promise<{shop?:string;from?:string;to?:string}>}){const p=await searchParams,{shop,user}=await shopOwnerAccess(p.shop).catch(e=>{if(e instanceof ShopAccessDenied||e instanceof ShopOwnerAccessDenied)notFound();throw e}),w=week();return <EarningsWorkspace shopId={shop.id} locations={(await teamView(shop.id,user.id,true)).shops.filter(s=>s.owner)} initial={await earningsView(shop.id,p.from||w.from,p.to||w.to)}/>}
