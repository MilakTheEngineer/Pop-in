import {shopAccess} from '@/lib/auth';
import {inboxView} from '@/lib/retention';
import {InboxWorkspace} from './workspace';
import '../commerce.css';
import '../retention.css';
export const dynamic='force-dynamic';
export default async function InboxPage(){const {shop}=await shopAccess();return <InboxWorkspace shopId={shop.id} initial={await inboxView(shop.id)} local={process.env.NODE_ENV==='development'}/>}
