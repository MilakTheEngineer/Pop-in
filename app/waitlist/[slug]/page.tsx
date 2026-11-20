import {notFound} from 'next/navigation';
import {db} from '@/lib/db';
import {publicShop} from '@/lib/guest';
import {JoinWaitlist} from './ui';
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params,shop=await publicShop(slug);if(!shop||!shop.booking_published)notFound();const [services,barbers,assignments]=await Promise.all([db.query('SELECT id,name,duration,price_cents FROM services WHERE shop_id=$1 ORDER BY name',[shop.id]),db.query('SELECT id,name FROM barbers WHERE shop_id=$1 ORDER BY name',[shop.id]),db.query('SELECT barber_id,service_id FROM barber_services WHERE shop_id=$1',[shop.id])]);return <JoinWaitlist shop={{name:shop.name,location:shop.location,accent:shop.accent,slug}} services={services.rows} barbers={barbers.rows} assignments={assignments.rows}/>}
