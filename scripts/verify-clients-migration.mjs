import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try{
 for(const name of ['001_initial','002_bookings','003_guest_booking','004_queue','005_whanau','006_visit_shop_integrity','007_queue_call_preview','008_reminders','009_reminder_deduplication'])await db.exec(await readFile(new URL(`../db/${name}.sql`,import.meta.url),'utf8'));
 await db.exec(`INSERT INTO shops(id,name,location) VALUES('test','Test','Rotorua'),('other','Other','Rotorua');
 INSERT INTO barbers(id,shop_id,name) VALUES('ari','test','Ari'),('other-barber','other','Barber');
 INSERT INTO services(id,shop_id,name,duration,price_cents) VALUES('cut','test','Cut',30,4500);
 INSERT INTO schedule_resources(barber_id,shop_id) VALUES('ari','test');
 INSERT INTO schedule_entries(id,shop_id,barber_id,resource_key,kind,status,source,service_id,service_name,duration_minutes,customer_name,customer_phone,starts_at,ends_at)
 SELECT 'old-a','test','ari',resource_key,'appointment','booked','guest','cut','Cut',30,'Luca','021 555 7788','2026-12-01T00:00Z','2026-12-01T00:30Z' FROM schedule_resources WHERE barber_id='ari';
 INSERT INTO schedule_entries(id,shop_id,barber_id,resource_key,kind,status,source,service_id,service_name,duration_minutes,customer_name,customer_phone,starts_at,ends_at)
 SELECT 'old-b','test','ari',resource_key,'appointment','booked','phone','cut','Cut',30,'Mia','0215557788','2026-12-01T00:30Z','2026-12-01T01:00Z' FROM schedule_resources WHERE barber_id='ari';
 INSERT INTO guest_booking_links(entry_id,token_hash,email,price_cents) VALUES('old-a','hash','luca@example.test',4000);`);
 await db.exec(await readFile(new URL('../db/010_clients.sql',import.meta.url),'utf8'));
 const legacy=await db.query('SELECT e.id,e.client_id,e.price_cents_snapshot,c.phone,c.email FROM schedule_entries e JOIN clients c ON c.id=e.client_id WHERE e.shop_id=$1 ORDER BY e.id',['test']);assert.equal(legacy.rows.length,2);assert.notEqual(legacy.rows[0].client_id,legacy.rows[1].client_id);assert.equal(legacy.rows[0].email,'luca@example.test');assert.equal(legacy.rows[0].price_cents_snapshot,null,'do not invent old prices');
 await db.exec(`INSERT INTO schedule_entries(id,shop_id,barber_id,resource_key,kind,status,source,service_id,service_name,duration_minutes,customer_name,customer_phone,starts_at,ends_at) SELECT 'new','test','ari',resource_key,'appointment','booked','phone','cut','Cut',30,'New','0215557788','2026-12-01T01:00Z','2026-12-01T01:30Z' FROM schedule_resources WHERE barber_id='ari';`);
 await db.exec("UPDATE services SET price_cents=5500 WHERE id='cut'");assert.equal((await db.query("SELECT price_cents_snapshot FROM schedule_entries WHERE id='new'")).rows[0].price_cents_snapshot,4500,'price remains the booking snapshot');
 await assert.rejects(db.exec(`INSERT INTO schedule_entries(id,shop_id,barber_id,resource_key,kind,status,source,service_id,service_name,duration_minutes,customer_name,starts_at,ends_at) SELECT 'conflict','test','ari',resource_key,'appointment','booked','phone','cut','Cut',30,'Conflict','2026-12-01T01:00Z','2026-12-01T01:30Z' FROM schedule_resources WHERE barber_id='ari'`));assert.equal((await db.query("SELECT count(*)::int AS n FROM clients WHERE id='booking:conflict'")).rows[0].n,0,'failed booking must not leave an orphan profile');
 await db.exec("INSERT INTO clients(id,shop_id,name) VALUES('other-client','other','Other person')");await assert.rejects(db.query("UPDATE schedule_entries SET client_id=$1 WHERE id='new'",['other-client']));await assert.rejects(db.query("UPDATE clients SET preferred_barber_id=$1 WHERE id='booking:old-a'",['other-barber']));
 console.log('PASS: existing appointments backfill without merging shared numbers, historical prices remain honest, new price snapshot, failed booking rolls back its profile.');
}finally{await db.close()}
