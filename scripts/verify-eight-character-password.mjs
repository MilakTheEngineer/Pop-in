import './local-qa-guard.mjs';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const target=new URL(process.env.DATABASE_URL||'postgresql://invalid');
if(target.hostname!=='127.0.0.1'||target.port!=='56441')throw Error('Use the isolated QA database.');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const suffix=randomUUID().slice(0,8),ownerEmail=`password-owner-${suffix}@example.test`,staffEmail=`password-staff-${suffix}@example.test`,password='C4nopy8!',base='http://127.0.0.1:3003';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),owner=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),staff=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),existing=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});owner.setDefaultTimeout(30000);staff.setDefaultTimeout(30000);existing.setDefaultTimeout(30000);let shopId='',ownerId='',staffId='',stage='owner signup';
try{
 await owner.goto(base+'/setup');
 const reject=async candidate=>owner.evaluate(async p=>{const r=await fetch('/api/onboarding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'signup',name:'Boundary QA',email:p.email,password:p.password,shopName:'Boundary QA',location:'Rotorua'})});return {status:r.status,body:await r.json()}},{email:`boundary-${suffix}@example.test`,password:candidate});
 for(const invalid of ['1234567','é'.repeat(37)]){const result=await reject(invalid);assert.equal(result.status,400,'invalid password must be rejected by the server');assert.match(result.body.error,/at least 8 characters/)}
 await owner.getByLabel('Password').fill('1234567');assert.equal(await owner.getByLabel('Password').evaluate(el=>el.validity.valid),false,'seven characters must be invalid in the setup form');
 await owner.getByLabel('Your name').fill('Password QA');await owner.getByLabel('Email address').fill(ownerEmail);await owner.getByLabel('Password').fill(password);await owner.getByLabel('Shop name').fill('Password QA shop');await owner.getByLabel('City or location').fill('Rotorua');assert.equal(await owner.getByLabel('Password').evaluate(el=>el.validity.valid),true,'eight characters must be valid in the setup form');await owner.getByRole('button',{name:'Create shop'}).click();await owner.waitForURL('**/onboarding');
 const row=(await db.query('SELECT s.id AS shop_id,u.id AS user_id,u.password_hash FROM shops s JOIN memberships m ON m.shop_id=s.id JOIN staff u ON u.id=m.staff_id WHERE u.email=$1',[ownerEmail])).rows[0];assert.ok(row);shopId=row.shop_id;ownerId=row.user_id;assert.ok(await bcrypt.compare(password,row.password_hash));
 stage='new staff invitation';await owner.getByRole('button',{name:'Invite staff',exact:true}).click();await owner.getByLabel('Email address').fill(staffEmail);await owner.getByRole('button',{name:'Create invitation'}).click();await owner.getByText(/Invitation created/).waitFor();const link=await owner.getByLabel('Private invitation link').inputValue();await staff.goto(link);await staff.getByRole('heading',{name:'Join Password QA shop'}).waitFor();await staff.getByLabel('Your name').fill('Staff QA');await staff.getByLabel('Password').fill(password);assert.equal(await staff.getByLabel('Password').evaluate(el=>el.validity.valid),true,'eight characters must be valid in the invitation form');await staff.getByRole('button',{name:'Accept invitation'}).click();await staff.waitForURL('**/today');staffId=(await db.query('SELECT id FROM staff WHERE email=$1',[staffEmail])).rows[0].id;
 stage='new account sign-in';await staff.getByRole('button',{name:'Sign out'}).click();await staff.waitForURL('**/login');await staff.getByLabel('Email').fill(staffEmail);await staff.getByLabel('Password').fill(password);await staff.getByRole('button',{name:'Sign in'}).click();await staff.waitForURL('**/today');
 stage='existing demo sign-in';await existing.goto(base+'/login');await existing.getByLabel('Email').fill('demo@rimu.example');await existing.getByLabel('Password').fill(process.env.DEMO_PASSWORD);await existing.getByRole('button',{name:'Sign in'}).click();await existing.waitForURL('**/today');
 console.log('PASS: seven characters and passwords over 72 UTF-8 bytes are rejected; eight-character passwords work for owner signup, staff invitation and sign-in; the existing demo password still works.');
}catch(e){console.error('Password verification failed at:',stage);throw e}finally{
 await browser.close();if(shopId)await db.query('DELETE FROM shops WHERE id=$1',[shopId]);const ids=[ownerId,staffId].filter(Boolean);if(ids.length)await db.query('DELETE FROM staff WHERE id=ANY($1::text[])',[ids]);await db.end();
}
