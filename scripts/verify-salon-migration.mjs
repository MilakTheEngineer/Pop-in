import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try{
 for(const name of (await readdir('db')).filter(x=>/^\d{3}_.+\.sql$/.test(x)).sort())await db.exec(await readFile('db/'+name,'utf8'));
 await db.exec(`INSERT INTO shops(id,name,location) VALUES('s','Rimu Barbers','Rotorua');
 INSERT INTO services(id,shop_id,name,duration,price_cents) VALUES('colour','s','Colour',150,17000),('cut','s','Cut',30,4500);
 INSERT INTO barbers(id,shop_id,name) VALUES('a','s','Ari'),('b','s','Jordan');
 INSERT INTO barber_services VALUES('s','a','colour'),('s','b','colour'),('s','a','cut');
 INSERT INTO salon_resources(id,shop_id,name) VALUES('chair','s','Chair 2');
 INSERT INTO salon_service_settings VALUES('s','colour',true,true);
 INSERT INTO salon_service_stages VALUES('s','colour',1,'Application',30,'booking',NULL,NULL),('s','colour',2,'Processing',90,'none',NULL,'chair'),('s','colour',3,'Finishing',30,'booking',NULL,NULL);
 INSERT INTO shop_hours SELECT 's',d,false,'09:00'::time,'17:30'::time FROM generate_series(0,6) d;
 INSERT INTO shifts SELECT 's',b,d,false,'09:00'::time,'17:30'::time FROM (VALUES('a'),('b')) v(b),generate_series(0,6) d;
 INSERT INTO schedule_resources(shop_id,barber_id) VALUES('s','a'),('s','b');`);
 const insert=async(id,barber,service,start,end)=>db.query(`INSERT INTO schedule_entries(id,shop_id,barber_id,resource_key,kind,status,source,service_id,service_name,duration_minutes,customer_name,starts_at,ends_at) SELECT $1,'s',$2,r.resource_key,'appointment','booked','phone',$3,s.name,s.duration,$1,$4,$5 FROM schedule_resources r JOIN services s ON s.id=$3 AND s.shop_id='s' WHERE r.barber_id=$2`,[id,barber,service,start,end]);
 await insert('colour-1','a','colour','2026-11-23T10:00:00+13:00','2026-11-23T12:30:00+13:00');
 assert.equal((await db.query("SELECT count(*)::int n FROM salon_appointment_stages WHERE entry_id='colour-1'")).rows[0].n,3);
 await insert('cut-1','a','cut','2026-11-23T10:30:00+13:00','2026-11-23T11:00:00+13:00');
 await assert.rejects(insert('chair-conflict','b','colour','2026-11-23T10:00:00+13:00','2026-11-23T12:30:00+13:00'),e=>e.code==='23P01');
 await assert.rejects(insert('staff-conflict','a','cut','2026-11-23T10:15:00+13:00','2026-11-23T10:45:00+13:00'),e=>e.code==='23P01');
 await db.query("UPDATE schedule_entries SET status='cancelled' WHERE id='colour-1'");
 await insert('chair-reopened','b','colour','2026-11-23T10:00:00+13:00','2026-11-23T12:30:00+13:00');
 console.log('PASS: migration, staged staff capacity, chair exclusion and cancellation release.');
}finally{await db.close()}
