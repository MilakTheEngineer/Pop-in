import {shopAccess,isShopOwner} from '@/lib/auth';
import {notFound} from 'next/navigation';
import {prepaidView} from '@/lib/commerce';
import {PrepaidWorkspace} from './workspace';
import '../commerce.css';
export const dynamic='force-dynamic';
export default async function PrepaidPage(){const {shop,user}=await shopAccess();if(!await isShopOwner(user.id,shop.id))notFound();return <PrepaidWorkspace shopId={shop.id} initial={await prepaidView(shop.id)}/>}
