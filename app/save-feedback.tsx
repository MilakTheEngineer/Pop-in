'use client';

import {createContext, useContext, useRef, useState, type FormEventHandler, type ReactNode} from 'react';

type SaveState = 'idle' | 'saving' | 'saved' | 'unknown' | 'error';
const SaveContext = createContext<SaveState>('idle');

export function SaveForm({action, children, className, onReset, resetOnSuccess=false}:{action:(data:FormData)=>Promise<void|{error:string}>;children:ReactNode;className?:string;onReset?:FormEventHandler<HTMLFormElement>;resetOnSuccess?:boolean}) {
 const [state,setState]=useState<SaveState>('idle');const [error,setError]=useState('');const lock=useRef(false);
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(lock.current)return;lock.current=true;const form=e.currentTarget;const data=new FormData(form);
  setState('saving');
  try { const result=await action(data);if(result?.error){setError(result.error);setState('error');return} if(resetOnSuccess)form.reset();form.dispatchEvent(new Event('popin-saved',{bubbles:true}));setState('saved'); }
  catch { setState('unknown'); }
  finally {lock.current=false}
 }
 return <SaveContext.Provider value={state}><form onSubmit={save} className={className} onChange={()=>{if(state==='saved'||state==='unknown'||state==='error')setState('idle')}} onClickCapture={e=>{if((e.target as HTMLElement).closest('[data-edits-form]')&&(state==='saved'||state==='unknown'||state==='error'))setState('idle')}} onReset={e=>{setState('idle');onReset?.(e)}}>{children}<span role="status" aria-live="polite" className={'save-feedback'+(state==='unknown'||state==='error'?'':' sr-only')}>{state==='saving'?'Saving…':state==='saved'?'Saved':state==='unknown'?"Couldn’t confirm the save. Check before trying again.":state==='error'?error:''}</span></form></SaveContext.Provider>;
}

export function SaveButton({children}:{children:ReactNode}){
 const state=useContext(SaveContext);
 return <button className="primary" disabled={state==='saving'}>{state==='saving'?'Saving…':state==='saved'?'Saved':children}</button>;
}
