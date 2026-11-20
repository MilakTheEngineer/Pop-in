import {shopAccess} from '@/lib/auth';
import {inventoryView} from '@/lib/commerce';
import {ProductsWorkspace} from './workspace';
import '../commerce.css';
export const dynamic='force-dynamic';
export default async function ProductsPage(){const {shop}=await shopAccess();return <ProductsWorkspace shopId={shop.id} initial={await inventoryView(shop.id)}/>}
