'use client';
import {useEffect} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';

export function RecordWorkspaceAccess({shopId}:{shopId:string}){
 const path=usePathname(),query=useSearchParams();
 const target=['/today','/calendar','/queue','/team'].includes(path||'')?(query.get('shop')||shopId):shopId;
 useEffect(()=>{void fetch('/api/staff-activation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'record',shopId:target})}).catch(()=>{});},[target]);
 return null;
}
