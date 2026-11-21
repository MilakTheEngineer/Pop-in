import Link from 'next/link';
import {shopAccess,isShopOwner} from '@/lib/auth';

export default async function Settings(){
 const {shop,user}=await shopAccess();
 const owner=await isShopOwner(user.id,shop.id);
 const links=[['integrations','Integrations','Connect and manage your calendar.'],['billing','Billing','Manage your Pop-in subscription.'],['import','Import from Fresha','Review and import your existing data.']] as const;
 return <main className="settings-page"><header className="settings-page-heading"><div className="eyebrow">YOUR SHOP / SETTINGS</div><h1>Settings</h1><p>Manage your connections and subscription.</p></header><section className="settings-content">{owner?<div className="settings-destinations">{links.map(([path,label,description])=><Link key={path} href={'/settings/'+path+'?shop='+encodeURIComponent(shop.id)}><strong>{label}</strong><span>{description}</span><span aria-hidden="true">→</span></Link>)}</div>:<p>Integrations, billing and imports are managed by the shop owner.</p>}</section></main>;
}
