import {pilotPublishingEnabled} from '@/lib/pilot';
import {notFound} from 'next/navigation';
import {publicShop} from '@/lib/guest';
import {db} from '@/lib/db';
import {WhanauBooking} from './ui';
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params,shop=await publicShop(slug);if(!shop)notFound();const services=await db.query('SELECT s.id,s.name,s.duration,s.price_cents FROM services s WHERE s.shop_id=$1 AND NOT EXISTS(SELECT 1 FROM salon_service_settings x WHERE x.shop_id=s.shop_id AND x.service_id=s.id) ORDER BY s.name',[shop.id]);return <WhanauBooking shop={{slug,name:shop.name,location:shop.location,accent:shop.accent}} services={services.rows} liveEmail={shop.booking_published&&await pilotPublishingEnabled(shop.id)}/>}
