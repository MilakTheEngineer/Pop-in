import Link from 'next/link';
import {ownerRecoveryAvailable} from '@/lib/owner-password-recovery';
import {OwnerRecovery} from './ui';
export const dynamic='force-dynamic';
export default function Page(){return ownerRecoveryAvailable()?<OwnerRecovery/>:<main className="setup-entry"><section className="setup-entry-card"><h1>Owner account recovery</h1><p>Recovery is unavailable. Contact Varello for help.</p><Link href="/login">Back to sign in</Link></section></main>}
