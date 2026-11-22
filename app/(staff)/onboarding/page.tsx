import {notFound} from 'next/navigation';
import {shopOwnerAccess,ShopAccessDenied,ShopOwnerAccessDenied} from '@/lib/auth';
import {onboardingView} from '@/lib/onboarding';
import {Onboarding} from './workspace';
import {hostedDemoEnabled} from '@/lib/confirmation';
import {pilotInvitesEnabled,pilotPublishingEnabled} from '@/lib/pilot';
export default async function Page({searchParams}:{searchParams:Promise<{shop?:string}>}){const p=await searchParams;const access=await shopOwnerAccess(p.shop).catch(e=>{if(e instanceof ShopAccessDenied||e instanceof ShopOwnerAccessDenied)notFound();throw e});const data=await onboardingView(access.shop.id);const pilot=await pilotInvitesEnabled(access.shop.id,access.user.id),pilotPublish=await pilotPublishingEnabled(access.shop.id,access.user.id);let publicOrigin="";if(hostedDemoEnabled()||pilot){try{const url=new URL(process.env.POPIN_PUBLIC_ORIGIN||"");if(url.protocol==="https:")publicOrigin=url.origin}catch{}}return <Onboarding initial={JSON.parse(JSON.stringify(data))} hostedPreview={hostedDemoEnabled()} pilotInvites={pilot} pilotPublish={pilotPublish} publicOrigin={publicOrigin}/>}
