'use client';
import {useEffect} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';

export function RecordWorkspaceAccess({shopId}:{shopId:string}){
 const path=usePathname(),query=useSearchParams();
 const target=['/today','/calendar','/queue','/team'].includes(path||'')?(query.get('shop')||shopId):shopId;
 useEffect(()=>{
  let stopped=false, timer:ReturnType<typeof setTimeout>|undefined, running=false, complete=false, delay=1000;
  async function record(){
   if(stopped||running||complete)return;
   running=true;
   try{
    const response=await fetch('/api/staff-activation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'record',shopId:target})});
    if(response.ok||(response.status>=400&&response.status<500&&response.status!==408&&response.status!==429)){complete=true;return}
   }catch{}
   finally{running=false}
   if(!stopped){timer=setTimeout(record,delay);delay=Math.min(delay*2,30000)}
  }
  function retry(){if(timer)clearTimeout(timer);timer=undefined;void record()}
  void record();window.addEventListener('online',retry);document.addEventListener('visibilitychange',retry);
  return()=>{stopped=true;if(timer)clearTimeout(timer);window.removeEventListener('online',retry);document.removeEventListener('visibilitychange',retry)};
 },[target]);
 return null;
}
