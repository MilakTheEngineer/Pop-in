'use client';
import {useEffect,useState} from 'react';
type Offer={amountCents:number;credits:number};
export function SmsTopup({shopId}:{shopId:string}){
 const [offer,setOffer]=useState<Offer|null>(null),[balance,setBalance]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;fetch('/api/sms-topup?shop='+encodeURIComponent(shopId),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(live&&d){setOffer(d.pack);setBalance(d.balance)}}).catch(()=>{});return()=>{live=false}},[shopId]);
 async function buy(){setBusy(true);setError('');try{const r=await fetch('/api/sms-topup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shopId})}),d=await r.json();if(!r.ok||!d.url)throw Error();window.location.assign(d.url)}catch{setError('Checkout is unavailable. Please try again later.');setBusy(false)}}
 if(!offer&&(balance===null||balance<=0))return null;return <section className="reminders-card"><h3>Optional SMS credits</h3>{offer&&<p>{new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(offer.amountCents/100)} NZD total for {offer.credits} credits. One SMS part uses one credit; longer messages can use multiple parts. Credits do not expire or renew automatically.</p>}<p>Available prepaid credits: {balance??'—'}. Existing sending limits still apply.</p>{error&&<p role="alert">{error}</p>}{offer&&<button type="button" className="outline" onClick={buy} disabled={busy}>{busy?'Opening checkout…':'Continue to secure checkout'}</button>}</section>
}
