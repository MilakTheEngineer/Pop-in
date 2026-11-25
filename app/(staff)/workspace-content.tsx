'use client';

import {useEffect,useState,type ReactNode} from 'react';

// Server-rendered controls must not accept edits before their client handlers exist.
export function WorkspaceContent({children}:{children:ReactNode}) {
 const [ready,setReady]=useState(false);
 useEffect(()=>setReady(true),[]);
 return <div className="staff-main" inert={!ready} aria-busy={!ready}>{children}</div>;
}
