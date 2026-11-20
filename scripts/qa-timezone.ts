import {chromium} from 'playwright';
import {Temporal} from '@js-temporal/polyfill';
import bcrypt from 'bcryptjs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {db} from '../lib/db';
import {createBooking,localInstant,slots} from '../lib/booking';

const target=new URL(process.env.DATABASE_URL||'postgresql://invalid');
if(target.hostname!=='127.0.0.1'||target.port!=='56441')throw Error('Use the isolated QA database.');
const base='http://127.0.0.1:3003',folder='artifacts/qa-20261121',phase=process.env.QA_ROUND||'baseline';
const suffix=randomUUID().slice(0,8),shop='tz-'+suffix,staff='tz-staff-'+suffix,barber='tz-barber-'+suffix,service='tz-cut-'+suffix,longService='tz-long-'+suffix,email=`tz-${suffix}@example.test`,password='qa-clock-test-only';
const spring='2027-09-26',fall='2027-04-04';
await mkdir(folder,{recursive:true});const results:Record<string,unknown>={spring,fall};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),midnight=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(30000);midnight.setDefaultTimeout(30000);
try{
 await db.query("INSERT INTO shops(id,name,location,public_slug) VALUES($1,'Timezone QA','Rotorua',$1)",[shop]);
 await db.query('INSERT INTO staff(id,email,password_hash,name) VALUES($1,$2,$3,$4)',[staff,email,await bcrypt.hash(password,10),'Clock QA']);
 await db.query('INSERT INTO memberships VALUES($1,$2)',[staff,shop]);
 await db.query("INSERT INTO barbers(id,shop_id,name) VALUES($1,$2,'Ari QA')",[barber,shop]);
 await db.query("INSERT INTO services(id,shop_id,name,duration,price_cents) VALUES($1,$2,'Timezone cut',30,4500)",[service,shop]);
 await db.query("INSERT INTO services(id,shop_id,name,duration,price_cents) VALUES($1,$2,'Timezone long cut',90,7500)",[longService,shop]);
 await db.query('INSERT INTO barber_services VALUES($1,$2,$3)',[shop,barber,service]);
 await db.query('INSERT INTO barber_services VALUES($1,$2,$3)',[shop,barber,longService]);
 for(let d=0;d<7;d++){await db.query("INSERT INTO shifts VALUES($1,$2,$3,false,'00:00','05:00')",[shop,barber,d]);await db.query("INSERT INTO shop_hours VALUES($1,$2,false,'00:00','05:00')",[shop,d])}
 assert.throws(()=>localInstant(spring,'02:15'),/invalid or ambiguous/);
 assert.throws(()=>localInstant(fall,'02:15'),/invalid or ambiguous/);
 const possible=await slots({shopId:shop,serviceId:service,barberId:barber,date:spring});
 assert.ok(possible.includes('01:45')&&!possible.includes('02:15'));
 const entry=await createBooking(shop,{barberId:barber,serviceId:service,date:spring,time:'01:45',customer:'Spring QA'});
 const saved=(await db.query('SELECT starts_at,ends_at FROM schedule_entries WHERE id=$1',[entry.id])).rows[0];
 assert.equal((saved.ends_at.getTime()-saved.starts_at.getTime())/60000,30);
 assert.equal(saved.starts_at.toISOString(),'2027-09-25T13:45:00.000Z');
 assert.equal(saved.ends_at.toISOString(),'2027-09-25T14:15:00.000Z');
 results.timezoneEngine='30 elapsed minutes saved in UTC; nonexistent spring and ambiguous autumn local times rejected.';
 await page.goto(base+'/login');await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await page.waitForURL('**/today');
 await page.goto(base+'/calendar');await page.waitForLoadState('networkidle');
 const response=page.waitForResponse(r=>r.url().includes('/api/schedule?')&&new URL(r.url()).searchParams.get('date')===spring&&r.status()===200);
 await page.getByLabel('Calendar date').fill(spring);await response;
 const event=page.locator('.timeline-event').filter({hasText:'Spring QA'});await event.waitFor();
 const width=await event.evaluate(e=>e.getBoundingClientRect().width),label=await event.innerText();
 const track=page.getByRole('button',{name:/Add booking for Ari QA/}),left=(await event.boundingBox())!.x-(await track.boundingBox())!.x;
 results.springGrid={label,leftPx:left,widthPx:width,expectedPx:66,passed:Math.abs(width-66)<0.1};
 const springHours=await page.locator('.timeline-hours span').allTextContents();results.springHours=springHours;
 await page.screenshot({path:`${folder}/${phase}-spring-timeline.png`,fullPage:false});
 if(process.env.QA_EXPECT_FIXED==='1'){
  assert.equal(left,99,'01:45 is 45 elapsed minutes after the first displayed hour');
  await track.click({position:{x:170,y:26}});await page.getByRole('heading',{name:'New booking'}).waitFor();
  await page.locator('select[required] option[value="03:15"]').waitFor({state:'attached'});
  assert.equal(await page.getByLabel('Available time').inputValue(),'03:15','clicking after the spring jump prefills the actual wall time');
  await page.getByLabel('Close',{exact:true}).click();
 }
 const autumn=await createBooking(shop,{barberId:barber,serviceId:longService,date:fall,time:'01:45',customer:'Autumn QA'});
 const autumnSaved=(await db.query('SELECT starts_at,ends_at FROM schedule_entries WHERE id=$1',[autumn.id])).rows[0];
 assert.equal(autumnSaved.starts_at.toISOString(),'2027-04-03T12:45:00.000Z');assert.equal(autumnSaved.ends_at.toISOString(),'2027-04-03T14:15:00.000Z');
 const autumnResponse=page.waitForResponse(r=>r.url().includes('/api/schedule?')&&new URL(r.url()).searchParams.get('date')===fall&&r.status()===200);
 await page.getByLabel('Calendar date').fill(fall);await autumnResponse;
 const autumnEvent=page.locator('.timeline-event').filter({hasText:'Autumn QA'});await autumnEvent.waitFor();
 const autumnWidth=await autumnEvent.evaluate(e=>e.getBoundingClientRect().width),autumnHours=await page.locator('.timeline-hours span').allTextContents();
 results.autumnGrid={label:await autumnEvent.innerText(),widthPx:autumnWidth,expectedPx:198,hours:autumnHours,passed:Math.abs(autumnWidth-198)<0.1};
 await page.screenshot({path:`${folder}/${phase}-autumn-timeline.png`,fullPage:false});
 await midnight.goto(base+'/login');await midnight.getByLabel('Email').fill(email);await midnight.getByLabel('Password').fill(password);await midnight.getByRole('button',{name:'Sign in'}).click();await midnight.waitForURL('**/today');
 const now=Temporal.Now.plainDateISO('Pacific/Auckland');
 const before=now.toZonedDateTime({timeZone:'Pacific/Auckland',plainTime:'23:59:00'}).toInstant().toString();
 await midnight.clock.install({time:new Date(before)});await midnight.goto(base+'/today');await midnight.waitForLoadState('networkidle');
 const beforeLabel=await midnight.locator('.workspace-date').innerText();await midnight.clock.fastForward('02:00');
 const afterLabel=await midnight.locator('.workspace-date').innerText(),expected=now.add({days:1}).toLocaleString('en-NZ',{weekday:'short',day:'numeric',month:'short'});
 results.midnight={beforeLabel,afterLabel,expected,passed:afterLabel===expected};
 await midnight.screenshot({path:`${folder}/${phase}-midnight-today.png`,fullPage:false});
 if(process.env.QA_EXPECT_FIXED==='1'){
  assert.equal(width,66,'grid must use the 30 real minutes across the spring clock change');
  assert.ok(springHours.includes('01:00')&&springHours.includes('03:00')&&!springHours.includes('02:00'),'spring axis skips the missing hour');
  assert.equal(autumnWidth,198,'grid must use the 90 real minutes across the autumn clock change');
  assert.ok(autumnHours.includes('02:00 (+13:00)')&&autumnHours.includes('02:00 (+12:00)'),'autumn axis distinguishes the repeated hour');
  assert.equal(afterLabel,expected,'Today must advance when midnight passes');
  await midnight.goto(base+'/calendar');await midnight.waitForLoadState('networkidle');await midnight.getByRole('button',{name:'Today',exact:true}).click();
  assert.equal(await midnight.getByLabel('Calendar date').inputValue(),now.add({days:1}).toString(),'Calendar Today selects the new Auckland date');
 }
 console.log(JSON.stringify(results));
}finally{
 await writeFile(`${folder}/timezone-${phase}.json`,JSON.stringify(results,null,2));await browser.close();
 await db.query('DELETE FROM schedule_entries WHERE shop_id=$1',[shop]);await db.query('DELETE FROM shops WHERE id=$1',[shop]);await db.query('DELETE FROM staff WHERE id=$1',[staff]);await db.end();
}
