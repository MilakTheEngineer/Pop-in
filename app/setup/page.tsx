import Link from 'next/link';
import {SetupForm} from './setup-form';
import {approvedSetupAvailable,localSetupAvailable} from '@/lib/setup-availability';
export const dynamic='force-dynamic';
export default async function Setup(){if(await approvedSetupAvailable())return <SetupForm approvedSignup/>;if(await localSetupAvailable())return <SetupForm/>;return <main className="setup-entry"><header><Link className="wordmark" href="/"><img src="/varello-wordmark.svg" alt="Varello"/></Link><Link href="/login?next=onboarding">Already have an account? Sign in</Link></header><section className="setup-entry-card"><Link href="/" className="setup-back">← Back</Link><h1>Shop setup is by invitation</h1><p>Public signup is closed while we prepare Varello. Sign in if you already have an account.</p><p><Link href="/login?next=onboarding">Already have an account? Sign in</Link></p></section></main>}
