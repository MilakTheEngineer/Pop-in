import {chromium} from 'playwright';
import {Temporal} from '@js-temporal/polyfill';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {db} from '../lib/db';

const target=new URL(process.env.DATABASE_URL||'postgresql://invalid');
if(target.hostname!=='127.0.0.1'||target.port!=='56441')throw Error('Use the isolated QA database.');
const base='http://127.0.0.1:3003',folder='artifacts/qa-20261121',tag=randomUUID().slice(0,8),shop=`guest-race-${tag}`,service=`cut-${tag}`,ari=`ari-${tag}`,jordan=`jordan-${tag}`;
const now=Temporal.Now.plainDateISO('Pacific/Auckland'),date=now.add({days:((6-now.dayOfWeek+7)%7)||7}),tomorrow=date.add({days:1});
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),one=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),two=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
one.setDefaultTimeout(30000);two.setDefaultTimeout(30000);const results:Record<string,unknown>={date:date.toString()};
try{
 await db.query("INSERT INTO shops(id,name,location,public_slug) VALUES($1,'Rimu Race QA','Rotorua',$1)",[shop]);
 await db.query("INSERT INTO services(id,shop_id,name,duration,price_cents) VALUES($1,$2,'Standard cut',30,4500)",[service,shop]);
 for(const [id,name,off] of [[ari,'Ari',false],[jordan,'Jordan',true]] as const){await db.query('INSERT INTO barbers(id,shop_id,name) VALUES($1,$2,$3)',[id,shop,name]);await db.query('INSERT INTO barber_services VALUES($1,$2,$3)',[shop,id,service]);for(let day=0;day<7;day++)await db.query("INSERT INTO shifts VALUES($1,$2,$3,$4,'09:00','09:30')",[shop,id,day,off])}
 for(let day=0;day<7;day++)await db.query("INSERT INTO shop_hours VALUES($1,$2,false,'09:00','09:30')",[shop,day]);
 async function prepare(page:typeof one,name:string,email:string){
  await page.goto(`${base}/book/${shop}`);await page.waitForLoadState('networkidle');await page.getByRole('button',{name:/Standard cut/}).click();await page.locator('.mobile-service-bar').getByRole('button',{name:'Continue'}).click();await page.getByLabel('Booking date').fill(date.toString());await page.getByRole('button',{name:'9:00 am',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('Your name').fill(name);await page.getByLabel('Email for confirmation').fill(email);
 }
 await Promise.all([prepare(one,'Race One',`one-${tag}@example.test`),prepare(two,'Race Two',`two-${tag}@example.test`)]);
 const requests=[one,two].map(p=>p.waitForResponse(r=>r.url().endsWith('/api/guest')&&r.request().postDataJSON()?.action==='book'));
 await Promise.all([one.getByRole('button',{name:'Confirm booking'}).click(),two.getByRole('button',{name:'Confirm booking'}).click()]);
 const responses=await Promise.all(requests);assert.deepEqual(responses.map(r=>r.status()).sort(),[200,400]);
 const winner=responses[0].status()===200?one:two,loser=winner===one?two:one;
 await winner.getByRole('heading',{name:/You’re booked\. See you/}).waitFor();await loser.locator('.guest-error[role=alert]').waitFor();
 assert.match(await loser.locator('.guest-error[role=alert]').innerText(),/details are still here/i);
 await loser.getByText('No times left on this date. Try another date or barber.').waitFor();
 const entries=(await db.query("SELECT e.customer_name,e.barber_id,e.starts_at,e.ends_at,g.price_cents FROM schedule_entries e JOIN guest_booking_links g ON g.entry_id=e.id WHERE e.shop_id=$1 AND e.status='booked'",[shop])).rows;
 assert.equal(entries.length,1);assert.equal(entries[0].barber_id,ari);assert.equal((entries[0].ends_at.getTime()-entries[0].starts_at.getTime())/60000,30);assert.equal(entries[0].price_cents,4500);
 await loser.getByLabel('Booking date').fill(tomorrow.toString());await loser.getByRole('button',{name:'9:00 am',exact:true}).click();await loser.getByRole('button',{name:'Continue',exact:true}).click();
 assert.match(await loser.getByLabel('Your name').inputValue(),/^Race (One|Two)$/);assert.match(await loser.getByLabel('Email for confirmation').inputValue(),/@example\.test$/);
 await loser.screenshot({path:folder+'/round4-guest-race-recovery-phone.png',fullPage:true});
 results.outcome={responses:responses.map(r=>r.status()).sort(),bookings:entries.length,barber:'Ari',durationMinutes:30,priceCents:4500,loser:'No remaining time explained; next day offered; name and email retained.'};
 console.log('PASS: two independent phone guests raced for the last slot; one booking won and the other recovered with details intact.');
}catch(e){results.error=e instanceof Error?e.message:String(e);throw e}finally{
 await writeFile(folder+'/guest-race-round4.json',JSON.stringify(results,null,2));await browser.close();
 const ids=(await db.query('SELECT id FROM schedule_entries WHERE shop_id=$1',[shop])).rows.map(r=>r.id);
 await db.query('DELETE FROM guest_booking_links WHERE entry_id=ANY($1::text[])',[ids]);await db.query('DELETE FROM schedule_entries WHERE shop_id=$1',[shop]);await db.query('DELETE FROM schedule_resources WHERE shop_id=$1',[shop]);await db.query('DELETE FROM shops WHERE id=$1',[shop]);await db.end();
}
