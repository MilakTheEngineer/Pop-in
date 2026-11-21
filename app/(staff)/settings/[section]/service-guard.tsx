'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useDiscardChanges} from '@/app/unsaved-changes';
const values=(form:HTMLFormElement)=>JSON.stringify(Array.from(new FormData(form).entries()));
export function ServiceGuard({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null),snap=useRef(new Map<HTMLFormElement,string>()),[dirty,setDirty]=useState(false);const {ask,dialog}=useDiscardChanges(dirty);
 useEffect(()=>{const node=root.current;if(!node)return;node.querySelectorAll('form').forEach(f=>snap.current.set(f,values(f)));const saved=(e:Event)=>{const form=e.target as HTMLFormElement;if(form instanceof HTMLFormElement){form.querySelectorAll('input,textarea,select').forEach(el=>{if(el instanceof HTMLInputElement){el.defaultValue=el.value;el.defaultChecked=el.checked}else if(el instanceof HTMLTextAreaElement)el.defaultValue=el.value;else if(el instanceof HTMLSelectElement)Array.from(el.options).forEach(o=>{o.defaultSelected=o.selected})});snap.current.set(form,values(form));setDirty([...snap.current].some(([f,v])=>f.isConnected&&values(f)!==v))}};node.addEventListener('popin-saved',saved);return()=>node.removeEventListener('popin-saved',saved)},[]);
 return <><div ref={root} onChange={()=>setDirty([...snap.current].some(([f,v])=>f.isConnected&&values(f)!==v))} onClickCapture={e=>{const summary=(e.target as Element).closest('summary');if(!dirty||!summary)return;e.preventDefault();e.stopPropagation();ask(()=>{for(const [f,v] of snap.current){if(values(f)!==v)f.reset()}setDirty(false);(summary.parentElement as HTMLDetailsElement).open=!(summary.parentElement as HTMLDetailsElement).open})}}>{children}</div>{dialog}</>;
}
