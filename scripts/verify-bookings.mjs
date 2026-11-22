import './local-qa-guard.mjs';
import {chromium} from 'playwright';
import {Temporal} from '@js-temporal/polyfill';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const suffix=randomUUID(),shop=`test-${suffix}`,other=`other-${suffix}`,barber=`barber-${suffix}`,service=`service-${suffix}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage();
try {
 await db.query("INSERT INTO shops(id,name,location) VALUES($1,'Z Test Shop','Rotorua')",[shop]);
 await db.query("INSERT INTO shops(id,name,location) VALUES($1,'Z Private Shop','Rotorua')",[other]);
 await db.query("INSERT INTO memberships VALUES('demo',$1)",[shop]);
 await db.query("INSERT INTO shop_owners(staff_id,shop_id) VALUES('demo',$1)",[shop]);
 await db.query("INSERT INTO barbers(id,shop_id,name) VALUES($1,$2,'Test barber')",[barber,shop]);
 await db.query("INSERT INTO services(id,shop_id,name,duration,price_cents) VALUES($1,$2,'Test cut',30,4500)",[service,shop]);
 await db.query('INSERT INTO barber_services VALUES($1,$2,$3)',[shop,barber,service]);
 for(let d=0;d<7;d++){await db.query("INSERT INTO shop_hours VALUES($1,$2,false,'09:00','17:30')",[shop,d]);await db.query("INSERT INTO shifts VALUES($1,$2,$3,false,'09:00','17:30')",[shop,barber,d]);}
 const date=Temporal.Now.plainDateISO('Pacific/Auckland').add({days:7}).toString();
 await page.goto('http://127.0.0.1:3001/login');await page.getByLabel('Email').fill('demo@rimu.example');await page.getByLabel('Password').fill(process.env.DEMO_PASSWORD);await page.getByRole('button',{name:'Sign in'}).click();await page.waitForURL('**/today');
 const call=(payload)=>page.evaluate(async data=>{const r=await fetch('/api/schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,body:await r.json()}},payload);
 const denied=await page.evaluate(async ({other,date})=>{const r=await fetch('/api/schedule?'+new URLSearchParams({shop:other,date}));return r.status},{other,date});assert.equal(denied,403,'cross-shop schedule read denied');assert.equal((await call({action:'block',shopId:other,barberId:barber,date,time:'09:00',endTime:'09:30',label:'No access'})).status,403,'cross-shop mutation denied');
 const block=(time,endTime)=>call({action:'block',shopId:shop,barberId:barber,date,time,endTime,label:'Test block'});
 assert.equal((await block('09:00','09:20')).status,200);assert.equal((await block('09:40','10:00')).status,200);
 const base={action:'create',shopId:shop,barberId:barber,serviceId:service,date,customer:'Test customer',phone:'',source:'phone'};
 const gap=await call({...base,time:'09:20'});assert.equal(gap.status,400,'30-minute service must not fit in 20-minute gap');
 const listed=await page.evaluate(async p=>{const u=new URL('/api/schedule',location.origin);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u);return r.json()},{view:'slots',shop,barber,service,date});assert.ok(!listed.slots.includes('09:20')&&!listed.slots.includes('09:30'));
 const race=await Promise.all([call({...base,time:'10:00'}),call({...base,time:'10:00'})]);assert.equal(race.filter(r=>r.status===200).length,1,JSON.stringify(race));assert.equal(race.filter(r=>r.status===400).length,1,JSON.stringify(race));const booking=race.find(r=>r.status===200).body.id;
 await assert.rejects(db.query("INSERT INTO schedule_entries(id,shop_id,barber_id,resource_key,kind,status,source,service_id,service_name,duration_minutes,customer_name,customer_phone,starts_at,ends_at) SELECT $2,shop_id,barber_id,resource_key,kind,status,source,service_id,service_name,duration_minutes,customer_name,customer_phone,starts_at,ends_at FROM schedule_entries WHERE id=$1",[booking,randomUUID()]),e=>e.code==='23P01','database constraint must independently reject overlap');
 const before=await db.query('SELECT starts_at,ends_at FROM schedule_entries WHERE id=$1',[booking]);const failedMove=await call({action:'move',shopId:shop,id:booking,barberId:barber,date,time:'09:20'});assert.equal(failedMove.status,400);const after=await db.query('SELECT starts_at,ends_at FROM schedule_entries WHERE id=$1',[booking]);assert.deepEqual(after.rows,before.rows,'failed move must preserve appointment');
 assert.equal((await call({action:'status',shopId:shop,id:booking,status:'cancelled'})).status,200);const replacement=await call({...base,time:'10:00'});assert.equal(replacement.status,200,'cancellation frees slot');assert.equal((await call({action:'move',shopId:shop,id:replacement.body.id,barberId:barber,date,time:'11:00'})).status,200,'available move succeeds');
 const walkin=await call({...base,time:'12:01',source:'walk_in'});assert.equal(walkin.status,200,'walk-ins use the booking engine');assert.equal((await db.query('SELECT source FROM schedule_entries WHERE id=$1',[walkin.body.id])).rows[0].source,'walk_in');assert.equal((await call({action:'status',shopId:shop,id:walkin.body.id,status:'completed'})).status,200);const absent=await call({...base,time:'13:00'});assert.equal(absent.status,200);assert.equal((await call({action:'status',shopId:shop,id:absent.body.id,status:'no_show'})).status,200);
 const day=Temporal.PlainDate.from(date).dayOfWeek%7;await db.query('UPDATE shifts SET off=true WHERE shop_id=$1 AND barber_id=$2 AND day=$3',[shop,barber,day]);assert.equal((await call({...base,time:'14:00'})).status,400,'off-shift booking denied');await db.query('UPDATE shifts SET off=false WHERE shop_id=$1 AND barber_id=$2 AND day=$3',[shop,barber,day]);await db.query('UPDATE shop_hours SET closed=true WHERE shop_id=$1 AND day=$2',[shop,day]);assert.equal((await call({...base,time:'14:00'})).status,400,'closed-shop booking denied');await db.query('UPDATE shop_hours SET closed=false WHERE shop_id=$1 AND day=$2',[shop,day]);await db.query('DELETE FROM barber_services WHERE shop_id=$1 AND barber_id=$2 AND service_id=$3',[shop,barber,service]);assert.equal((await call({...base,time:'14:00'})).status,400,'unassigned service denied');await db.query('INSERT INTO barber_services VALUES($1,$2,$3)',[shop,barber,service]);
 const tomorrow=Temporal.PlainDate.from(date).add({days:1}).toString();assert.equal((await call({action:'block',shopId:shop,barberId:barber,date,time:'16:00',endDate:tomorrow,endTime:'12:00',label:'Time off'})).status,200);assert.equal((await call({...base,date:tomorrow,time:'09:00'})).status,400,'multi-day time off blocks the following day');
 await page.goto('http://127.0.0.1:3001/calendar'); await page.getByRole('button',{name:'Add booking',exact:true}).click();assert.ok(await page.getByRole('dialog',{name:'New booking'}).isVisible());await page.getByRole('button',{name:'Close',exact:true}).first().click();
 await page.setViewportSize({width:390,height:844});await page.reload();await page.getByRole('button',{name:'Add booking',exact:true}).click();const rect=await page.getByRole('dialog').boundingBox();assert.ok(rect&&rect.width===390&&rect.height===844,'booking panel fills phone viewport');await page.getByRole('button',{name:'Close',exact:true}).first().click();assert.equal(await page.locator('.timeline-row:visible').count(),1);
 console.log('PASS: concurrent slot requests, 20-minute gap, cancellation, failed move, desktop panel and phone calendar/panel.');
} finally {await db.query('DELETE FROM schedule_entries WHERE shop_id=$1',[shop]);await db.query('DELETE FROM schedule_resources WHERE shop_id=$1',[shop]);await db.query('DELETE FROM shops WHERE id IN ($1,$2)',[shop,other]);await browser.close();await db.end();}
