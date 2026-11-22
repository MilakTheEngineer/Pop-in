import Link from 'next/link';
import {SetupForm} from './setup-form';
import {BetaContact} from '@/app/beta-contact';
import {localSetupAvailable} from '@/lib/setup-availability';
export const dynamic='force-dynamic';
export default async function Setup(){if(await localSetupAvailable())return <SetupForm/>;return <main className="setup-entry"><header><Link className="wordmark" href="/"><img src="/varello-wordmark.svg" alt="Varello"/></Link><Link href="/login?next=onboarding">Already have an account? Sign in</Link></header><section className="setup-entry-card"><Link href="/" className="setup-back">← Back</Link><h1>Shop setup is by invitation</h1><p>Public signup is closed while we prepare Varello. Contact us to register your interest in the beta; we’ll review it and get in touch.</p><BetaContact/><p><Link href="/login?next=onboarding">Already have an account? Sign in</Link></p></section></main>}
