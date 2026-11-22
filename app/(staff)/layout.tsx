import Link from 'next/link';
import {Suspense} from 'react';
import { shopAccess,isShopOwner } from '@/lib/auth';
import { logout,switchShop } from '@/app/actions';
import {Nav} from './nav';
import {db} from '@/lib/db';
import {RecordWorkspaceAccess} from './record-workspace-access';
import './staff-theme.css';
export default async function StaffLayout({children}:{children:React.ReactNode}) { const {user,shop,shops}=await shopAccess();const owner=await isShopOwner(user.id,shop.id);const appearance=await db.query('SELECT theme FROM shop_appearance WHERE shop_id=$1',[shop.id]);const theme=appearance.rows[0]?.theme||'pine'; return <div className="staff-shell" data-staff-theme={theme}><header className="topbar"><Link className="wordmark" href="/today"><img src="/varello-wordmark.svg" alt="Varello"/></Link><div className="header-shop">{shops.length>1?<form action={switchShop} className="shop-switch"><label className="sr-only" htmlFor="active-shop">Current shop</label><select id="active-shop" name="shopId" defaultValue={shop.id}>{shops.map(s=><option key={s.id} value={s.id}>{s.name} · {s.location}</option>)}</select><button>Switch</button></form>:<><strong>{shop.name}</strong><small>{shop.location}</small></>}</div><div className="topright"><span className="avatar">{user.name[0]}</span><span className="profile-name">{user.name}<small>{owner?'Shop owner':'Staff account'}</small></span><form action={logout}><button className="signout">Sign out</button></form></div></header><div className="staff-body"><Nav owner={owner}/><div className="staff-main"><Suspense fallback={null}><RecordWorkspaceAccess shopId={shop.id}/></Suspense> {children}</div></div></div> }
