'use client';
import {useRef,useState} from 'react';

export function BetaContact({kind='regular'}:{kind?:'regular'|'founding'}){
 const [message,setMessage]=useState(''),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[conflict,setConflict]=useState(false);
 const requestId=useRef<string|null>(null);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);setError('');try{
  requestId.current??=crypto.randomUUID();
  const r=await fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json'},referrerPolicy:'no-referrer',body:JSON.stringify({id:requestId.current,screen:'Beta',category:'idea',message:`${kind==='founding'?'Founder':'Regular'} beta interest: ${message.trim()}`,replyEmail:email.trim()})});
  const data=await r.json();if(r.status===409)setConflict(true);if(!r.ok)throw Error(data.error||'Could not send your interest. Try again.');setSaved(true);
 }catch(e){setError(e instanceof Error?e.message:'Could not send your interest. Try again.')}finally{setBusy(false)}}
 if(saved)return <p role="status">Thanks. Your beta interest was saved for review.</p>;
 return <form className="setup-form" onSubmit={submit}><label>Tell us about your shop<textarea required maxLength={900} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Shop name, town and what you’re looking for"/></label><label>Reply email<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><p>Please don’t include customer details.</p>{error&&<p className="form-error" role="alert">{error}</p>}{conflict&&<button type="button" className="outline" onClick={()=>{requestId.current=null;setMessage('');setEmail('');setError('');setConflict(false)}}>Start over</button>}<button className="primary" disabled={busy||conflict}>{busy?'Sending…':'Send beta interest'}</button></form>;
}
