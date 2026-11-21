import {shopAccess,isShopOwner} from '@/lib/auth';
import {inventoryView} from '@/lib/commerce';
import {ProductsWorkspace} from './workspace';
import '../commerce.css';
export const dynamic='force-dynamic';
export default async function ProductsPage(){const {shop,user}=await shopAccess();const owner=await isShopOwner(user.id,shop.id),inventory=await inventoryView(shop.id);if(owner)return <ProductsWorkspace shopId={shop.id} initial={inventory}/>;return <main className="commerce-page"><div className="commerce-heading"><div><div className="commerce-eyebrow">YOUR SHOP</div><h1>Products</h1><p>Prices and stock at this location.</p></div></div><section className="commerce-card"><h2>Stock</h2>{inventory.products.length?<div className="commerce-table-wrap"><table><thead><tr><th>Product</th><th>On hand</th><th>Price (NZD)</th></tr></thead><tbody>{inventory.products.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.on_hand} {p.unit}</td><td>NZ${(p.price_cents/100).toFixed(2)}</td></tr>)}</tbody></table></div>:<p>No products at this location.</p>}</section></main>}
