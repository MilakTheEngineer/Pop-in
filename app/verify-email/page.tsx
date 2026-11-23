'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';

export default function VerifyEmail(){
 const [token,setToken]=useState(''),[state,setState]=useState<'ready'|'busy'|'done'|'error'>('ready'),[message,setMessage]=useState('');
 useEffect(()=>{const value=window.location.hash.slice(1);if(!value)return;setToken(value);window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search)},[]);
 async function verify(){if(!token)return;setState('busy');try{const r=await fetch('/api/owner-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify',token}),referrerPolicy:'no-referrer'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not verify email.');setToken('');setState('done')}catch(error){setMessage(error instanceof Error?error.message:'Could not verify email.');setState('error')}}
 return <main className="setup-entry"><section className="setup-entry-card"><h1>Verify your email</h1>{state==='done'?<><p role="status">Your email is verified. You can return to shop setup.</p><Link href="/onboarding">Go to setup</Link></>:<><p>Confirm this email address for your Varello owner account.</p>{!token&&<p role="alert">Open the full verification link from your email.</p>}{state==='error'&&<p className="form-error" role="alert">{message}</p>}<button type="button" className="primary" disabled={!token||state==='busy'} onClick={verify}>{state==='busy'?'Verifying…':'Verify email'}</button><p><Link href="/onboarding">Back to setup</Link></p></>}</section></main>;
}
