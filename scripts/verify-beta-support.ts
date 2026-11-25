import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';

const target=new URL(process.env.DATABASE_URL||'postgresql://invalid');
if(target.hostname!=='127.0.0.1'||target.port!==(process.env.QA_DB_PORT||'56441')||process.env.POPIN_ENVIRONMENT!=='local')throw Error('Use the isolated local QA database.');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:390,height:844}}),tag=randomUUID().slice(0,8),ids=[1,2,3,4].map(n=>`qa-beta-${tag}-${n}`);
const api=(path:string,data:Record<string,unknown>)=>page.evaluate(async({path,data})=>{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,body:await response.json()}},{path,data});
try{
 await db.query("UPDATE location_groups SET plan_code='pro' WHERE id=(SELECT location_group_id FROM shops WHERE id='rimu')");
 for(const [i,id] of ids.entries()){
  await db.query('INSERT INTO shops(id,name,location,public_slug) VALUES($1,$2,$3,$1)',[id,`Fictional shop ${i+1}`,'Rotorua']);
  await db.query("INSERT INTO beta_applications(shop_id,kind,state,contact_email) VALUES($1,'founding',$2,$3)",[id,i<3?'approved':'pending',`founder-${i}@example.test`]);
 }
 await db.query('INSERT INTO memberships(staff_id,shop_id) VALUES($1,$2)',['demo',ids[3]]);
 await db.query('INSERT INTO shop_owners(staff_id,shop_id) VALUES($1,$2)',['demo',ids[3]]);
 await page.goto(`http://127.0.0.1:${process.env.QA_APP_PORT||'3003'}/login`);await page.getByLabel('Email',{exact:true}).fill('demo@rimu.example');await page.getByLabel('Password').fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Sign in'}).click();await page.waitForURL('**/today');
 const fourth=await api('/api/beta/operator',{action:'approve',shopId:ids[3]});assert.equal(fourth.status,400);
 const interest=await api('/api/beta',{action:'apply',shopId:ids[3],kind:'regular'});assert.equal(interest.status,200);
 const app=(await db.query('SELECT kind,state,activated_at FROM beta_applications WHERE shop_id=$1',[ids[3]])).rows[0];assert.deepEqual(app,{kind:'founding',state:'pending',activated_at:null});
 const queue=await page.evaluate(async()=>await (await fetch('/api/beta/operator')).json());assert.ok(queue.interest.some((i:{shop_id:string;contact_email:string})=>i.shop_id===ids[3]&&i.contact_email==='founder-3@example.test'));
 const privacy=await browser.newPage({viewport:{width:1440,height:900}});
 await privacy.goto(`http://127.0.0.1:${process.env.QA_APP_PORT||'3003'}/privacy`);
 assert.equal(await privacy.title(),'Privacy | Varello');
 const copy=await privacy.locator('main').innerText();assert.match(copy,/queued message does not by itself mean/);assert.match(copy,/access or correct/);assert.doesNotMatch(copy,/No real SMS or email|full privacy policy before/);
 await mkdir('artifacts',{recursive:true});await privacy.screenshot({path:'artifacts/privacy-desktop.png',fullPage:true});
 await privacy.setViewportSize({width:390,height:844});assert.ok(await privacy.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await privacy.screenshot({path:'artifacts/privacy-mobile.png',fullPage:true});
 const trigger=privacy.locator('main').getByRole('button',{name:'Report an issue'});await trigger.focus();await privacy.keyboard.press('Enter');
 const dialog=privacy.getByRole('dialog',{name:'Report an issue',exact:true}),draft=`QA ${tag}: contact test@example.test or 021 555 0199`;
 await dialog.getByLabel('What happened?').filter({visible:true}).fill(draft);
 await privacy.route('**/api/support',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Could not save your report. Please try again.'})}),{times:1});
 await dialog.getByRole('button',{name:'Send report'}).click();await dialog.getByRole('alert').waitFor();
 assert.equal(await dialog.getByLabel('What happened?').filter({visible:true}).inputValue(),draft);assert.equal(await dialog.getByText('Thanks. Your report was saved.').count(),0);
 await dialog.getByRole('button',{name:'Send report'}).click();await dialog.getByText('Thanks. Your report was saved.').waitFor();
 const reports=await page.evaluate(async()=>await (await fetch('/api/support/operator')).json());const matched=reports.reports.filter((r:{message:string})=>r.message.includes(tag));assert.equal(matched.length,1);assert.match(matched[0].message,/\[email removed\]/);assert.match(matched[0].message,/\[number removed\]/);
 console.log('PASS: Founder cap, regular interest preserves pending application, factual privacy desktop/mobile, keyboard support form, failed-save draft and retry, one redacted private issue report.');
}finally{await browser.close();await db.query('DELETE FROM support_reports WHERE message LIKE $1',[`%${tag}%`]);await db.query('DELETE FROM shops WHERE id=ANY($1::text[])',[ids]);await db.end()}
