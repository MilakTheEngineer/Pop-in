'use client';
import {useState} from 'react';
export default function PrivateOwnerSetup(){
 const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{const token=window.location.hash.slice(1);const r=await fetch('/api/private-owner-setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});const d=await r.json();if(!r.ok)throw Error(d.error);window.history.replaceState(null,'',window.location.pathname);window.location.assign('/onboarding')}catch(e){setError(e instanceof Error?e.message:'Please try again.');setBusy(false)}}
 return <main style={{maxWidth:480,margin:'4rem auto',padding:24}}><h1>Set up your private test shop</h1><p>Choose a password for your owner account. The shop starts private.</p><form onSubmit={submit}><label>Password <input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={e=>setPassword(e.target.value)}/></label><p>At least 8 characters.</p>{error&&<p role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy?'Creating…':'Create private test shop'}</button></form></main>;
}
