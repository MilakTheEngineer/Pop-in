'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {CalendarDays,CalendarClock,Clock3,UsersRound,ContactRound,Settings,ClipboardList,ChartNoAxesColumn,BadgeDollarSign,Package,Gift,UserRoundCog,HandCoins,MessageSquareText,Megaphone,CalendarHeart,MoreHorizontal,ChevronDown} from 'lucide-react';

const common=[['/today','Today',Clock3],['/calendar','Calendar',CalendarDays],['/queue','Queue',UsersRound],['/waitlist','Waitlist',CalendarClock],['/clients','Clients',ContactRound],['/inbox','Inbox',MessageSquareText],['/team','Team',UserRoundCog]] as const;
const extras=[['/products','Products',Package],['/prepaid','Prepaid',Gift]] as const;
const ownerExtras=[['/events','Events',CalendarHeart],['/campaigns','Campaigns',Megaphone],['/earnings','Earnings',HandCoins],['/deposits','Deposits',BadgeDollarSign],['/reports','Reports',ChartNoAxesColumn]] as const;
export function Nav({owner=false}:{owner?:boolean}){
 const path=usePathname();
 const primary=owner?([['/onboarding','Setup',ClipboardList] as const,...common]):common;
 const extraLinks=owner?[...extras,...ownerExtras]:extras;
 const activeExtra=extraLinks.some(([href])=>path===href||path.startsWith(href+'/'));
 const [expanded,setExpanded]=useState(activeExtra);
 useEffect(()=>{if(activeExtra)setExpanded(true)},[path,activeExtra]);
 function link([href,label,Icon]:readonly [string,string,typeof Clock3]){const selected=path===href||path.startsWith(href+'/');return <Link key={href} href={href} className={selected?'selected':''} aria-current={selected?'page':undefined}><Icon size={20}/><span>{label}</span></Link>}
 const settingsSelected=path==='/settings'||path.startsWith('/settings/');
 return <nav className="staff-rail" aria-label="Staff navigation"><div className="staff-rail-scroll">{primary.map(link)}<button type="button" className={'staff-extras-toggle'+(activeExtra?' has-active':'')} aria-expanded={expanded} aria-controls="staff-extras" onClick={()=>setExpanded(v=>!v)}><MoreHorizontal size={20}/><span>Extras <ChevronDown size={12} className={expanded?'expanded':''}/></span></button><div id="staff-extras" className="staff-extras" hidden={!expanded}>{extraLinks.map(link)}</div></div><Link href="/settings/shop" className={'staff-settings'+(settingsSelected?' selected':'')} aria-current={settingsSelected?'page':undefined}><Settings size={20}/><span>Settings</span></Link></nav>;
}
