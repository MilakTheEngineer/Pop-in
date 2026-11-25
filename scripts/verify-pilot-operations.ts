import './local-qa-guard.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import {chromium,type Page} from 'playwright';
import {Temporal} from '@js-temporal/polyfill';

// Separate local fictional shop and accounts; no hosted site or provider needed.
const base=`http://127.0.0.1:${process.env.QA_APP_PORT||'3003'}`;
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const operator=await browser.newPage({viewport:{width:1440,height:900}}),owner=await browser.newPage(),staff=await browser.newPage(),anonymous=await browser.newPage();
const tag=randomUUID().slice(0,8),shop=`ops-${tag}`,other=`ops-empty-${tag}`,ownerId=`ops-owner-${tag}`,staffId=`ops-staff-${tag}`,barber=`ops-barber-${tag}`,service=`ops-service-${tag}`,password='Fictional-operator-QA-8';
const customer=`Fictional client ${tag}`,phone='0215550123';
const post=(page:Page,path:string,data:Record<string,unknown>)=>page.evaluate(async({path,data})=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,body:await r.json()}},{path,data});
async function login(page:Page,email:string,pass:string,next='today'){
 await page.goto(base+'/login'+(next==='operator'?'?next=operator':''));await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password').fill(pass);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(`**/${next}`);
}
try{
 assert.ok((await db.query("SELECT 1 FROM staff WHERE id='demo' AND email='demo@rimu.example'")).rowCount,'Seed the local operator fixture first.');
 for(const id of [shop,other])await db.query('INSERT INTO shops(id,name,location,public_slug) VALUES($1,$2,$3,$1)',[id,`Fictional operations ${id}`,'Rotorua']);
 await db.query("UPDATE location_groups SET plan_code='pro' WHERE id=(SELECT location_group_id FROM shops WHERE id=$1)",[shop]);
 for(const id of [ownerId,staffId]){
  await db.query('INSERT INTO staff(id,email,password_hash,name) VALUES($1,$2,$3,$4)',[id,`${id}@example.test`,await bcrypt.hash(password,10),id===ownerId?'Fictional owner':'Fictional staff']);
  await db.query('INSERT INTO memberships(staff_id,shop_id) VALUES($1,$2)',[id,shop]);
 }
 await db.query('INSERT INTO shop_owners(staff_id,shop_id) VALUES($1,$2)',[ownerId,shop]);
 await db.query("INSERT INTO services(id,shop_id,name,duration,price_cents) VALUES($1,$2,'Standard cut',30,4500)",[service,shop]);
 await db.query("INSERT INTO barbers(id,shop_id,name) VALUES($1,$2,'Fictional barber')",[barber,shop]);
 await db.query('INSERT INTO barber_services VALUES($1,$2,$3)',[shop,barber,service]);
 for(let day=0;day<7;day++){
  await db.query("INSERT INTO shop_hours VALUES($1,$2,false,'09:00','17:00')",[shop,day]);
  await db.query("INSERT INTO shifts VALUES($1,$2,$3,false,'09:00','17:00')",[shop,barber,day]);
 }
 assert.equal((await anonymous.request.get(base+'/api/operator')).status(),401);
 assert.equal((await anonymous.request.get(base+'/api/operator',{headers:{'oai-authenticated-user-id':'demo'}})).status(),401);
 await login(staff,`${staffId}@example.test`,password);await login(owner,`${ownerId}@example.test`,password);
 for(const page of [staff,owner]){
  assert.equal((await page.goto(base+'/operator'))?.status(),404);
  assert.equal((await page.request.get(base+'/api/operator')).status(),403);
  assert.equal((await post(page,'/api/operator',{action:'acknowledge',eventId:randomUUID(),eventSource:'booking',shopId:shop})).status,403);
 }
 await staff.goto(base+'/today');await owner.goto(base+'/today');
 const date=Temporal.Now.plainDateISO('Pacific/Auckland').add({days:1}).toString();
 const booking={action:'create',shopId:shop,barberId:barber,serviceId:service,date,time:'10:00',customer,phone};
 const first=await post(staff,'/api/schedule',booking);assert.equal(first.status,200,JSON.stringify(first));
 assert.equal((await post(staff,'/api/schedule',booking)).status,400,'real duplicate slot generates redacted error');
 const settings={action:'save',shopId:shop,enabled:true,channel:'sms',leadMinutes:2880};
 assert.equal((await post(staff,'/api/reminders',settings)).status,403);
 assert.equal((await post(owner,'/api/reminders',settings)).status,200);
 const preview=await post(owner,'/api/reminders',{action:'run',shopId:shop,simulateFailure:true});assert.equal(preview.status,200);assert.equal(preview.body.created,1);
 await login(operator,'demo@rimu.example',process.env.DEMO_PASSWORD!,'operator');
 assert.equal((await db.query("SELECT 1 FROM memberships WHERE staff_id='demo' AND shop_id=$1",[shop])).rowCount,0,'operator identity separate from membership');
 const response=await operator.request.get(base+'/api/operator?shop='+shop);assert.equal(response.status(),200);
 const text=await response.text(),data=JSON.parse(text);for(const secret of [customer,phone,password])assert.ok(!text.includes(secret));
 assert.equal(data.booking.count,1);assert.equal(data.booking.heartbeats[0].source,'staff');assert.equal(data.previewFailures.count,1);
 assert.equal(data.deliveries.status,'unknown');assert.match(data.deliveries.reason,/not available in this overview/);assert.equal(data.backup.status,'unknown');assert.equal(data.restore.status,'unknown');
 await operator.getByLabel('Filter by shop').selectOption(shop);await operator.getByText('Recent signals: Staff',{exact:true}).waitFor();
 assert.match(await operator.locator('.ops-stats').innerText(),/Failed deliveries\s+Unknown/);
 await mkdir('artifacts',{recursive:true});await operator.screenshot({path:'artifacts/pilot-operations-overview.png',fullPage:true});
 await operator.locator('.ops-card').filter({hasText:'Booking errors'}).locator('tbody button').first().click();
 const dialog=operator.getByRole('dialog',{name:'Incident details'});await dialog.getByText('Slot unavailable',{exact:true}).waitFor();
 await dialog.getByRole('button',{name:'Mark reviewed'}).click();await dialog.getByText('Marked reviewed',{exact:false}).waitFor();
 await dialog.getByRole('button',{name:'Reopen event'}).click();await dialog.getByText('Reopened',{exact:false}).waitFor();
 assert.equal((await db.query('SELECT status FROM schedule_entries WHERE id=$1',[first.body.id])).rows[0].status,'booked');
 assert.equal((await db.query("SELECT count(*)::int AS n FROM operator_support_audit WHERE shop_id=$1 AND event_source='booking'",[shop])).rows[0].n,2);
 await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await operator.locator('.ops-card').filter({hasText:'Local preview failures'}).locator('tbody button').first().click();
 await dialog.getByText('Local reminder preview failure',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Mark reviewed'}).click();await dialog.getByText('Marked reviewed',{exact:false}).waitFor();
 assert.equal((await db.query("SELECT count(*)::int AS n FROM reminder_log WHERE shop_id=$1 AND status='failed'",[shop])).rows[0].n,1,'review does not retry');
 await dialog.getByRole('button',{name:'Close',exact:true}).click();
 const action={action:'acknowledge',eventId:data.booking.events[0].id,eventSource:'booking',shopId:shop};
 assert.equal((await post(operator,'/api/operator',{...action,notes:'must not be stored'})).status,400);
 assert.equal((await operator.request.post(base+'/api/operator',{headers:{origin:'https://example.test'},data:action})).status(),403);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM operator_support_audit WHERE shop_id=$1',[shop])).rows[0].n,3);
 await operator.getByLabel('Filter by shop').selectOption(other);await operator.getByText('No recorded booking errors').waitFor();
 assert.match(await operator.locator('.ops-stats').innerText(),/Observed booking errors · 7 days\s+Unknown/);
 await operator.getByLabel('Filter by shop').selectOption(shop);await operator.getByText('Recent signals: Staff',{exact:true}).waitFor();
 await operator.setViewportSize({width:390,height:844});assert.ok(await operator.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await operator.screenshot({path:'artifacts/pilot-operations-mobile.png',fullPage:true});
 await operator.locator('.ops-card').filter({hasText:'Booking errors'}).locator('tbody button').first().click();
 assert.ok((await dialog.boundingBox())!.width<=390);await operator.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 await db.query('BEGIN');try{await db.query('DELETE FROM schedule_entries WHERE shop_id=$1',[shop]);await db.query('DELETE FROM schedule_resources WHERE shop_id=$1',[shop]);await db.query('DELETE FROM shops WHERE id=$1',[shop]);assert.equal((await db.query('SELECT count(*)::int AS n FROM operator_support_audit WHERE shop_id=$1',[shop])).rows[0].n,3);}finally{await db.query('ROLLBACK')}
 console.log('PASS: isolated local operator; anonymous/forged/staff/owner denial; real conflict and simulated reminder; redaction, audited review/reopen, no resend, unknown missing signals, shop filtering, audit retention, desktop/mobile and Escape.');
}catch(error){console.error('Operator QA failed:',error);throw error}finally{
 await browser.close();await db.query('DELETE FROM operator_support_audit WHERE shop_id=ANY($1::text[])',[[shop,other]]);
 await db.query('DELETE FROM schedule_entries WHERE shop_id=$1',[shop]);await db.query('DELETE FROM schedule_resources WHERE shop_id=$1',[shop]);
 await db.query('DELETE FROM staff WHERE id=ANY($1::text[])',[[ownerId,staffId]]);await db.query('DELETE FROM shops WHERE id=ANY($1::text[])',[[shop,other]]);await db.end();
}
