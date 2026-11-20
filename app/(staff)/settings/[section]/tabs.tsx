'use client';
import Link from 'next/link';
import {useEffect,useRef} from 'react';
export function SettingsTabs({links,section,shopId}:{links:ReadonlyArray<readonly [string,string]>;section:string;shopId:string}){const nav=useRef<HTMLElement>(null);useEffect(()=>{nav.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({block:'nearest',inline:'nearest'})},[section]);return <nav ref={nav} className="settings-tabs" aria-label="Settings sections">{links.map(([path,label])=><Link key={path} href={'/settings/'+path+'?shop='+encodeURIComponent(shopId)} className={section===path?'active':''} aria-current={section===path?'page':undefined}>{label}</Link>)}</nav>}
