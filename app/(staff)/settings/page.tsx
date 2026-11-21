import {redirect} from 'next/navigation';
import {shopAccess,isShopOwner} from '@/lib/auth';

export default async function Settings({searchParams}:{searchParams:Promise<{shop?:string}>}){
 const query=await searchParams;
 const {shop,user}=await shopAccess(query.shop);
 const owner=await isShopOwner(user.id,shop.id);
 if(owner)redirect('/settings/integrations?shop='+encodeURIComponent(shop.id));
 return <main className="settings-page"><header className="settings-page-heading"><div className="eyebrow">YOUR SHOP / SETTINGS</div><h1>Settings</h1></header><section className="settings-content"><p>Settings are managed by the shop owner.</p></section></main>;
}
