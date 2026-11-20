import {notFound} from 'next/navigation';
import {publicShop} from '@/lib/guest';
import {db} from '@/lib/db';
import {ShopProducts} from './ui';
import './products.css';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params,shop=await publicShop(slug);if(!shop)notFound();const products=(await db.query('SELECT id,name,unit,price_cents,(on_hand>0) AS available FROM products WHERE shop_id=$1 ORDER BY name',[shop.id])).rows;return <ShopProducts shop={{slug,name:shop.name,location:shop.location,accent:shop.accent}} products={products}/>}
