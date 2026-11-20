import {notFound} from 'next/navigation';
import {shopOwnerAccess,ShopAccessDenied,ShopOwnerAccessDenied} from '@/lib/auth';
import {campaignList} from '@/lib/retention';
import {CampaignWorkspace} from './workspace';
import '../commerce.css';
import '../retention.css';
export const dynamic='force-dynamic';
export default async function CampaignsPage(){const {shop}=await shopOwnerAccess().catch(e=>{if(e instanceof ShopAccessDenied||e instanceof ShopOwnerAccessDenied)notFound();throw e});return <CampaignWorkspace shopId={shop.id} initial={await campaignList(shop.id)} local={process.env.NODE_ENV==='development'}/>}
