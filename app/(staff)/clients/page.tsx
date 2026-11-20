import {shopAccess} from '@/lib/auth';
import {ClientsWorkspace} from './workspace';
export default async function ClientsPage(){const {shop}=await shopAccess();return <ClientsWorkspace shopId={shop.id}/>}
