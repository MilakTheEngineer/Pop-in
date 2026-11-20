import {notFound} from 'next/navigation';
import {shopOwnerAccess,ShopAccessDenied,ShopOwnerAccessDenied} from '@/lib/auth';
import {communityOptions,listCommunityEvents} from '@/lib/community';
import {EventsWorkspace} from './workspace';
import '../commerce.css';
import './events.css';
export const dynamic='force-dynamic';
export default async function EventsPage(){const {shop}=await shopOwnerAccess().catch(e=>{if(e instanceof ShopAccessDenied||e instanceof ShopOwnerAccessDenied)notFound();throw e});return <EventsWorkspace shopId={shop.id} shopName={shop.name} initial={await listCommunityEvents(shop.id)} options={await communityOptions(shop.id)}/>}
