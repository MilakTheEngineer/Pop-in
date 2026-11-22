import './local-qa-guard.mjs';
import {chromium} from 'playwright';
import {Temporal} from '@js-temporal/polyfill';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {clearFixtureProfiles} from './fixture-cleanup.mjs';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const customer=`UI test ${randomUUID()}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1280,height:900}});
try {
 await page.goto('http://127.0.0.1:3001/login');await page.getByLabel('Email').fill('demo@rimu.example');await page.getByLabel('Password').fill(process.env.DEMO_PASSWORD);await page.getByRole('button',{name:'Sign in'}).click();await page.waitForURL('**/today');
 let date=Temporal.Now.plainDateISO('Pacific/Auckland').add({days:14});while(date.dayOfWeek!==1)date=date.add({days:1});
 const p={view:'slots',shop:'rimu',service:'standard',barber:'ari',date:date.toString()};const slots=await page.evaluate(async p=>{const r=await fetch('/api/schedule?'+new URLSearchParams(p));return r.json()},p);assert.ok(slots.slots?.length,'seed must provide a test slot');const time=slots.slots[0];
 await page.goto('http://127.0.0.1:3001/calendar');await page.getByLabel('Calendar date').fill(date.toString());await page.getByRole('button',{name:'Add booking',exact:true}).click();const dialog=page.getByRole('dialog',{name:'New booking'});await dialog.getByLabel('Service',{exact:true}).selectOption('standard');await dialog.getByLabel('Barber').selectOption('ari');await page.waitForFunction(t=>Array.from(document.querySelectorAll('select option')).some(o=>o.value===t),time);await dialog.getByLabel('Available time').selectOption(time);await dialog.getByLabel('Customer name').fill(customer);await dialog.getByLabel('Mobile').fill('021 555 0101');await dialog.getByRole('button',{name:'Save booking'}).click();await dialog.waitFor({state:'hidden'});const event=page.locator('.timeline-event').filter({hasText:customer});await event.waitFor();const dimensions=await event.evaluate(el=>({top:parseFloat(el.style.left),height:parseFloat(el.style.width)}));assert.equal(dimensions.height,66,'30 minutes must occupy half an hour in the grid');const minutes=Number(time.slice(0,2))*60+Number(time.slice(3));assert.equal(dimensions.top,(minutes-8*60)*132/60,'calendar position must match start time');
 await event.click();await page.getByRole('dialog',{name:'Appointment details'}).waitFor();assert.ok(await page.getByText('021 555 0101').isVisible());page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Cancel booking'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await event.waitFor({state:'hidden'});
 console.log('PASS: staff booking panel saves, calendar positions duration and start correctly, details open, and cancellation removes it.');
} finally {const ids=(await db.query('SELECT id FROM schedule_entries WHERE shop_id=$1 AND customer_name=$2',['rimu',customer])).rows.map(x=>x.id);await db.query('DELETE FROM schedule_entries WHERE id=ANY($1::text[])',[ids]);await clearFixtureProfiles(db,ids);await browser.close();await db.end();}
