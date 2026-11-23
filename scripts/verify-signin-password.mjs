import './local-qa-guard.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import pg from 'pg';

const base=`http://127.0.0.1:${process.env.QA_APP_PORT||'3003'}`;
const tag=randomUUID(),ownerEmail=`password-owner-${tag}@example.test`,staffEmail=`password-staff-${tag}@example.test`;
const password='  fictional password  ';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const owner=await browser.newPage({viewport:{width:390,height:844}}),employee=await browser.newPage();
const post=(page,data)=>page.evaluate(async data=>{const response=await fetch('/api/onboarding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,body:await response.json()}},data);
async function signBackIn(page,email){
 await page.getByRole('button',{name:'Sign out'}).click();await page.waitForURL('**/login');
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password').fill(password.trim());
 await page.getByRole('button',{name:'Sign in'}).click();await page.waitForURL('**/login?error=1');
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password').fill(password);
 await page.getByRole('button',{name:'Sign in'}).click();
 await page.waitForURL('**/today');
 assert.equal(new URL(page.url()).pathname,'/today','The exact password accepted at account creation must sign in');
}
try{
 await owner.goto(base+'/setup');
 assert.equal((await post(owner,{action:'signup',name:'Password QA',email:ownerEmail,password,shopName:'Password QA',streetAddress:'1 Fictional Street',location:'Rotorua'})).status,200);
 await owner.goto(base+'/onboarding');await signBackIn(owner,ownerEmail);
 const shop=(await db.query('SELECT shop_id FROM shop_owners o JOIN staff s ON s.id=o.staff_id WHERE s.email=$1',[ownerEmail])).rows[0].shop_id;
 await db.query("UPDATE location_groups SET plan_code='pro' WHERE id=(SELECT location_group_id FROM shops WHERE id=$1)",[shop]);
 const invite=await post(owner,{action:'invite',shopId:shop,email:staffEmail});assert.equal(invite.status,200);
 await employee.goto(invite.body.inviteUrl);await employee.getByLabel('Your name').fill('Password staff QA');await employee.getByLabel('Password').fill(password);
 await employee.getByRole('button',{name:'Accept invitation'}).click();await employee.waitForURL('**/today');await signBackIn(employee,staffEmail);
 console.log('PASS: owner signup and separate staff invitation accept whitespace-containing passwords; exact passwords sign in, trimmed variants do not.');
}finally{
 await browser.close();
 await db.query('DELETE FROM shops WHERE id IN (SELECT shop_id FROM shop_owners WHERE staff_id IN (SELECT id FROM staff WHERE email=$1))',[ownerEmail]);
 await db.query('DELETE FROM staff WHERE email=ANY($1::text[])',[[ownerEmail,staffEmail]]);await db.end();
}
