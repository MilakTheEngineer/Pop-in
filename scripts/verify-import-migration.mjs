import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try{
 for(const name of ['001_initial','002_bookings','003_guest_booking','004_queue','005_whanau','006_visit_shop_integrity','007_queue_call_preview','008_reminders','009_reminder_deduplication','010_clients'])await db.exec(await readFile(new URL(`../db/${name}.sql`,import.meta.url),'utf8'));
 await db.exec(`INSERT INTO shops(id,name,location) VALUES('rimu','Rimu Barbers','Rotorua'),('other','Other','Rotorua');INSERT INTO staff(id,email,password_hash,name) VALUES('demo','demo@rimu.example','hash','Demo'),('ordinary','ordinary@example.test','hash','Staff');INSERT INTO memberships VALUES('demo','rimu'),('ordinary','rimu'),('ordinary','other');`);
 await db.exec(await readFile(new URL('../db/011_fresha_import.sql',import.meta.url),'utf8'));const owners=(await db.query('SELECT staff_id,shop_id FROM shop_owners ORDER BY staff_id')).rows;assert.deepEqual(owners,[{staff_id:'demo',shop_id:'rimu'}]);await assert.rejects(db.query('INSERT INTO shop_owners(staff_id,shop_id) VALUES($1,$2)',['demo','other']));assert.equal((await db.query("SELECT count(*)::int AS n FROM shop_owners WHERE staff_id='ordinary'")).rows[0].n,0,'existing membership is not promoted');
 console.log('PASS: import migration grants only the fictional demo owner and requires shop membership for owner grants.');
}finally{await db.close()}
