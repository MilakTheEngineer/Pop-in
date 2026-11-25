import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

// This test creates tables, so never point it at a shared database.
const url=new URL(process.env.DATABASE_URL||'postgresql://invalid');
if(url.hostname!=='127.0.0.1'||url.port!==(process.env.QA_DB_PORT||'56441')||url.pathname!=='/varello_sms_race')throw Error('Use the dedicated local varello_sms_race database.');
process.env.WEBSMS_CUSTOMER_ENABLED='true';process.env.WEBSMS_PILOT_MAX_PARTS='100';
const admin=new pg.Client({connectionString:process.env.DATABASE_URL});await admin.connect();
await admin.query(`CREATE TABLE location_groups(id text PRIMARY KEY,plan_code text); CREATE TABLE shops(id text PRIMARY KEY,name text,location_group_id text);
CREATE TABLE memberships(staff_id text,shop_id text); CREATE TABLE barbers(id text,shop_id text,person_id text); CREATE TABLE staff_barber_links(staff_id text,barber_id text,shop_id text);
CREATE TABLE reminder_settings(shop_id text PRIMARY KEY,enabled boolean,channel text,lead_minutes int);
CREATE TABLE schedule_entries(id text PRIMARY KEY,shop_id text,kind text,status text,suppress_reminders boolean,onboarding_test boolean,starts_at timestamptz,customer_phone text);
CREATE TABLE beta_reminder_consent(entry_id text PRIMARY KEY,sms boolean,email boolean);
CREATE TABLE guest_visits(id text PRIMARY KEY,shop_id text,status text,organiser_phone text); CREATE TABLE beta_visit_reminder_consent(visit_id text PRIMARY KEY,sms boolean,email boolean);
CREATE TABLE guest_visit_people(visit_id text,shop_id text,entry_id text); CREATE TABLE beta_sms_pilot_lock(id int PRIMARY KEY);
INSERT INTO beta_sms_pilot_lock VALUES(1); INSERT INTO location_groups VALUES('group','pro'); INSERT INTO shops VALUES('shop','Rimu','group'); INSERT INTO reminder_settings VALUES('shop',true,'sms',1440);`);
await admin.query(await readFile('db/059_sms_reminder_outbox.sql','utf8'));
await admin.query('CREATE TABLE isolated_smoke(shop_id text PRIMARY KEY)');
await admin.query(await readFile('db/065_sms_prepaid.sql','utf8'));
const {db}=await import('../lib/db');const {enqueueDueSmsReminders,dispatchSmsReminder}=await import('../lib/sms-reminder-outbox');
const future=new Date(Date.now()+3600000),midday=new Date('2026-12-15T01:00:00Z');
let signal!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>signal=r),wait=new Promise<void>(r=>release=r);let calls=0;
try{
 await admin.query("INSERT INTO schedule_entries VALUES('one','shop','appointment','booked',false,false,$1,'0215550100')",[future]);await admin.query("INSERT INTO beta_reminder_consent VALUES('one',true,false,'0215550100')");await enqueueDueSmsReminders();
 const first=dispatchSmsReminder(async()=>{calls++;signal();await wait;return {status:'accepted',providerId:'fictional-1',parts:1}},midday,async()=>true);
 await Promise.race([entered,new Promise((_,reject)=>setTimeout(()=>reject(Error('Mock dispatch did not begin')),10000))]);
 const other=await dispatchSmsReminder(async()=>{calls++;return {status:'accepted',providerId:'fictional-2',parts:1}},midday,async()=>true);assert.equal(other.status,'none');
 let cancelled=false;const cancel=admin.query("UPDATE schedule_entries SET status='cancelled' WHERE id='one'").then(()=>{cancelled=true});await new Promise(r=>setTimeout(r,200));assert.equal(cancelled,false,'cancellation waits for the dispatch lock');
 release();assert.equal((await first).status,'accepted');await cancel;assert.equal(calls,1);assert.equal(await enqueueDueSmsReminders(),0);
 console.log('PASS: real PostgreSQL competing workers send once; cancellation serializes with an in-flight send. Fictional data and mock provider.');
}finally{release();await db.end();await admin.end()}
