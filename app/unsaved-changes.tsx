'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
export function useDiscardChanges(dirty:boolean){
 const pending=useRef<(()=>void)|null>(null),bypass=useRef(false),[open,setOpen]=useState(false);
 const ask=useCallback((next:()=>void)=>{if(!dirty){next();return}pending.current=next;setOpen(true)},[dirty]);
 useEffect(()=>{if(!dirty)return;const unload=(e:BeforeUnloadEvent)=>{if(bypass.current)return;e.preventDefault();e.returnValue=''};const click=(e:MouseEvent)=>{if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const a=(e.target as Element).closest('a[href]') as HTMLAnchorElement|null;if(!a||a.target||a.origin!==location.origin||a.href===location.href)return;e.preventDefault();e.stopPropagation();pending.current=()=>{location.href=a.href};setOpen(true)};window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true);return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true)}},[dirty]);
 const dialog=open?<div className="commerce-overlay"><section className="commerce-dialog" role="dialog" aria-modal="true" aria-labelledby="discard-title"><h2 id="discard-title">Discard unsaved changes?</h2><p>Your edits haven’t been saved.</p><button type="button" className="outline" onClick={()=>{pending.current=null;setOpen(false)}}>Keep editing</button>{' '}<button type="button" className="primary" onClick={()=>{const next=pending.current;pending.current=null;setOpen(false);bypass.current=true;next?.();setTimeout(()=>{bypass.current=false},0)}}>Discard changes</button></section></div>:null;
 return {ask,dialog};
}
