import {shopAccess,isShopOwner} from '@/lib/auth';
import {hostedDemoEnabled} from '@/lib/confirmation';
import {inboxView} from '@/lib/retention';
import {InboxWorkspace} from './workspace';
import '../commerce.css';
import '../retention.css';
export const dynamic='force-dynamic';
export default async function InboxPage(){const {shop,user}=await shopAccess();const canAddSamples=(process.env.NODE_ENV==='development'||hostedDemoEnabled())&&await isShopOwner(user.id,shop.id);return <InboxWorkspace shopId={shop.id} initial={await inboxView(shop.id)} local={process.env.NODE_ENV==='development'} canAddSamples={canAddSamples}/>}
