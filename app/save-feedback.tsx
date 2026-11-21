'use client';

import {createContext, useContext, useRef, useState, type FormEventHandler, type ReactNode} from 'react';

type SaveState = 'idle' | 'saving' | 'saved' | 'unknown';
const SaveContext = createContext<SaveState>('idle');

export function SaveForm({action, children, className, onReset, resetOnSuccess=false}:{action:(data:FormData)=>Promise<void>;children:ReactNode;className?:string;onReset?:FormEventHandler<HTMLFormElement>;resetOnSuccess?:boolean}) {
 const [state,setState]=useState<SaveState>('idle');const lock=useRef(false);
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(lock.current)return;lock.current=true;const form=e.currentTarget;const data=new FormData(form);
  setState('saving');
  try { await action(data); if(resetOnSuccess)form.reset();setState('saved'); }
  catch { setState('unknown'); }
  finally {lock.current=false}
 }
 return <SaveContext.Provider value={state}><form onSubmit={save} className={className} onChange={()=>{if(state==='saved'||state==='unknown')setState('idle')}} onReset={e=>{setState('idle');onReset?.(e)}}>{children}<span role="status" aria-live="polite" className="save-feedback">{state==='saving'?'Saving…':state==='saved'?'Saved':state==='unknown'?"Couldn’t confirm the save. Check before trying again.":''}</span></form></SaveContext.Provider>;
}

export function SaveButton({children}:{children:ReactNode}){
 const state=useContext(SaveContext);
 return <button className="primary" disabled={state==='saving'}>{state==='saving'?'Saving…':state==='saved'?'Saved':children}</button>;
}
