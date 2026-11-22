import './local-qa-guard.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Temporal} from '@js-temporal/polyfill';
import {chromium} from 'playwright';
import pg from 'pg';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const owner=await browser.newPage(),employee=await browser.newPage({viewport:{width:390,height:844}}),suffix=randomUUID().slice(0,8),email=`staff-${suffix}@example.test`,name=`Fictional staff ${suffix}`;
const api=(page:typeof owner,path:string,data:Record<string,unknown>)=>page.evaluate(async({path,data})=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,body:await r.json()}},{path,data});
try{
 await db.query("UPDATE location_groups SET plan_code='pro' WHERE id=(SELECT location_group_id FROM shops WHERE id='rimu')");
 await owner.goto('http://127.0.0.1:3001/login');await owner.getByLabel('Email',{exact:true}).fill('demo@rimu.example');await owner.getByLabel('Password').fill(process.env.DEMO_PASSWORD!);await owner.getByRole('button',{name:'Sign in'}).click();await owner.waitForURL('**/today');
 const invite=await api(owner,'/api/onboarding',{action:'invite',shopId:'rimu',email});assert.equal(invite.status,200,JSON.stringify(invite));
 await employee.goto(invite.body.inviteUrl);await employee.getByLabel('Your name').fill(name);await employee.getByLabel('Password').fill(process.env.DEMO_PASSWORD!);await employee.getByRole('button',{name:'Accept invitation'}).click();await employee.waitForURL('**/today');await employee.getByRole('link',{name:'Calendar'}).waitFor();
 let date=Temporal.Now.plainDateISO('Pacific/Auckland').add({days:7});while(date.dayOfWeek===7)date=date.add({days:1});const d=date.toString();
 const available=await employee.evaluate(async date=>{const r=await fetch('/api/schedule?'+new URLSearchParams({view:'slots',shop:'rimu',barber:'jordan',service:'standard',date}));return r.json()},d);assert.ok(available.slots.length);
 const created=await api(employee,'/api/schedule',{action:'create',shopId:'rimu',barberId:'jordan',serviceId:'standard',date:d,time:available.slots[0],customer:name,source:'phone'});assert.equal(created.status,200,JSON.stringify(created));
 const denied=await employee.goto('http://127.0.0.1:3001/reports');assert.equal(denied?.status(),404);await owner.goto('http://127.0.0.1:3001/team');await owner.getByText(name,{exact:true}).first().waitFor();
 console.log('PASS: owner invitation, staff sign-in, colleague booking, owner-only report denial and Team visibility.');
}finally{await browser.close();await db.query('DELETE FROM schedule_entries WHERE shop_id=$1 AND customer_name=$2',['rimu',name]);await db.query('DELETE FROM staff WHERE email=$1',[email]);await db.end()}
