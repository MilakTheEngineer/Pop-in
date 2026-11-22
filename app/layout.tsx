import './style.css';
import {Suspense} from 'react';
import {connection} from 'next/server';
import {hostedDemoEnabled} from '@/lib/confirmation';
import {ReportIssue} from './report-issue';
export async function generateMetadata(){await connection();let image:string|undefined;try{const u=new URL(process.env.POPIN_PUBLIC_ORIGIN||''),host=u.hostname.toLowerCase().replace(/\.$/,'');if(u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash&&host!=='localhost'&&!host.endsWith('.localhost')&&!host.startsWith('127.')&&!['0.0.0.0','[::1]'].includes(host))image=new URL('/social-card',u.origin).href;}catch{}return {title:'Varello',description:'Good cuts. Better bookings.',openGraph:{title:'Varello',description:'Good cuts. Better bookings.',type:'website' as const,images:image?[{url:image,width:1200,height:630,alt:'Varello — Good cuts. Better bookings.'}]:[]},twitter:{card:'summary_large_image' as const,title:'Varello',description:'Good cuts. Better bookings.',images:image?[image]:[]},...(hostedDemoEnabled()?{robots:{index:false,follow:false}}:{})};}
async function DemoBanner(){await connection();return hostedDemoEnabled()?<div className="hosted-demo-banner" role="status"><strong>Demo environment.</strong> Use fictional customer details and an @example.test email for demo bookings. No emails or texts are sent.</div>:null}
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en-NZ"><body><Suspense fallback={null}><DemoBanner/></Suspense>{children}<Suspense fallback={null}><ReportIssue/></Suspense></body></html>}
