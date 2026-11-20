import {notFound} from 'next/navigation';
import {shopAccess,ShopAccessDenied,isShopOwner} from '@/lib/auth';
import {teamView} from '@/lib/team';
import {TeamWorkspace} from './workspace';
import '../commerce.css';
import './team.css';
export const dynamic='force-dynamic';
export default async function TeamPage({searchParams}:{searchParams:Promise<{shop?:string}>}){const p=await searchParams,{user,shop}=await shopAccess(p.shop).catch(e=>{if(e instanceof ShopAccessDenied)notFound();throw e}),owner=await isShopOwner(user.id,shop.id);return <TeamWorkspace shopId={shop.id} owner={owner} initial={await teamView(shop.id,user.id,owner)}/>}
