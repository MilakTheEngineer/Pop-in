import {NextRequest,NextResponse} from 'next/server';
import {smokeCookie,smokeConfig,smokeSecretValid} from './lib/smoke-config';
// Capability browsers may exercise only the core flow, never integrations,
// billing, campaigns, directory publication, or global operator operations.
export function proxy(request:NextRequest){
 const value=request.cookies.get(smokeCookie)?.value;
 if(!value)return NextResponse.next();
 const path=request.nextUrl.pathname,c=smokeConfig();
 const allowed=path.startsWith('/_next/')||path.startsWith('/icons/')||path==='/favicon.ico'||path==='/varello-wordmark.svg'||['/','/login','/today','/calendar','/onboarding','/invite','/verify-email','/manage','/settings','/settings/profile','/settings/services','/settings/team','/settings/hours','/team','/api/isolated-smoke','/api/onboarding','/api/guest','/api/owner-email','/api/team','/api/shop-settings','/api/schedule','/api/staff-activation'].includes(path)||path==='/book/'+c?.shopId;
 if(!smokeSecretValid(value)||!allowed)return new NextResponse('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 return NextResponse.next();
}
export const config={matcher:['/((?!_next/static|_next/image).*)']};
