import {notFound} from 'next/navigation';
import {shopOwnerAccess,ShopAccessDenied,ShopOwnerAccessDenied} from '@/lib/auth';
import {onboardingView} from '@/lib/onboarding';
import {Onboarding} from './workspace';
import {hostedDemoEnabled} from '@/lib/confirmation';
export default async function Page(){const access=await shopOwnerAccess().catch(e=>{if(e instanceof ShopAccessDenied||e instanceof ShopOwnerAccessDenied)notFound();throw e});const data=await onboardingView(access.shop.id);let publicOrigin="";if(hostedDemoEnabled()){try{const url=new URL(process.env.POPIN_PUBLIC_ORIGIN||"");if(url.protocol==="https:")publicOrigin=url.origin}catch{}}return <Onboarding initial={JSON.parse(JSON.stringify(data))} hostedPreview={hostedDemoEnabled()} publicOrigin={publicOrigin}/>}
