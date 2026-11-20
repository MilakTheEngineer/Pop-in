import {shopAccess} from '@/lib/auth';
import {prepaidView} from '@/lib/commerce';
import {PrepaidWorkspace} from './workspace';
import '../commerce.css';
export const dynamic='force-dynamic';
export default async function PrepaidPage(){const {shop}=await shopAccess();return <PrepaidWorkspace shopId={shop.id} initial={await prepaidView(shop.id)}/>}
