import {notFound} from 'next/navigation';
import {shopAccess,isShopOwner} from '@/lib/auth';
import {BookingError} from '@/lib/booking';
import {checkoutView} from '@/lib/checkout';
import {CheckoutWorkspace} from './workspace';
import '../checkout.css';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params,{user,shop}=await shopAccess();const initial=await checkoutView(shop.id,id).catch(e=>{if(e instanceof BookingError)notFound();throw e});return <CheckoutWorkspace shopId={shop.id} initial={initial} owner={await isShopOwner(user.id,shop.id)}/>}
