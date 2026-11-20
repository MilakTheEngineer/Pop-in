import {notFound} from 'next/navigation';
import {shopAccess} from '@/lib/auth';
import {BookingError} from '@/lib/booking';
import {checkoutReceipt} from '@/lib/checkout';
import {ReceiptView} from './view';
import '../../checkout.css';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params,{shop}=await shopAccess();const receipt=await checkoutReceipt(shop.id,id).catch(e=>{if(e instanceof BookingError)notFound();throw e});return <ReceiptView id={receipt.id} snapshot={receipt.snapshot}/>}
