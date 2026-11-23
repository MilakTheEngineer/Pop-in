import './local-qa-guard.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {db} from '../lib/db';
import {createOwnerShop} from '../lib/onboarding';
import {issueOwnerVerification,ownerEmailState} from '../lib/owner-email-verification';
const base=`http://127.0.0.1:${process.env.QA_APP_PORT||'3003'}`,email=`verify-ui-${randomUUID()}@example.test`,password='fictional-verify-only';
process.env.RESEND_API_KEY='fictional';process.env.POPIN_EMAIL_FROM='test@example.test';process.env.POPIN_PUBLIC_ORIGIN=base;
const owner=await createOwnerShop({name:'Verify QA',shopName:'Verify QA',email,password,streetAddress:'1 Fictional Street',location:'Rotorua'});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})}),page=await browser.newPage();page.setDefaultTimeout(15000);
try{
 let link='';await issueOwnerVerification(owner.userId,async message=>{link=message.text.match(/http:\/\/[^\s]+/)![0]});
 await page.goto(link);await page.getByRole('button',{name:'Verify email',exact:true}).click();await page.getByRole('status').waitFor();
 assert.equal((await ownerEmailState(owner.userId)).verified,true);assert.equal(new URL(page.url()).hash,'');
 await page.goto(base+'/login');await page.goto(link);await page.getByRole('button',{name:'Verify email',exact:true}).click();await page.getByRole('alert').filter({hasText:'invalid or expired'}).waitFor();
 console.log('PASS: one-use fake-delivered verification link consumed through signed-out browser UI and fragment removed.');
}finally{await browser.close();await db.query('DELETE FROM shops WHERE id=$1',[owner.shopId]);await db.query('DELETE FROM staff WHERE id=$1',[owner.userId]);await db.end()}
