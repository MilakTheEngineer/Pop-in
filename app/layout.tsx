import './style.css';
import {Suspense} from 'react';
import {connection} from 'next/server';
import {hostedDemoEnabled} from '@/lib/confirmation';
export async function generateMetadata(){await connection();return {title:'Pop-in',description:'A little more time for good cuts.',...(hostedDemoEnabled()?{robots:{index:false,follow:false}}:{})};}
async function DemoBanner(){await connection();return hostedDemoEnabled()?<div className="hosted-demo-banner" role="status"><strong>Fictional demo.</strong> Use test details and an @example.test email. No emails or texts are sent.</div>:null}
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en-NZ"><body><Suspense fallback={null}><DemoBanner/></Suspense>{children}</body></html>}
