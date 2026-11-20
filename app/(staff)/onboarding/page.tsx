import {notFound} from 'next/navigation';
import {shopOwnerAccess,ShopAccessDenied,ShopOwnerAccessDenied} from '@/lib/auth';
import {onboardingView} from '@/lib/onboarding';
import {Onboarding} from './workspace';
export default async function Page(){const access=await shopOwnerAccess().catch(e=>{if(e instanceof ShopAccessDenied||e instanceof ShopOwnerAccessDenied)notFound();throw e});const data=await onboardingView(access.shop.id);return <Onboarding initial={JSON.parse(JSON.stringify(data))}/>}
