import pg from 'pg';
import bcrypt from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import { readFileSync } from 'node:fs';
if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL first. See README.md.'); process.exit(1); }
const client = new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  await client.query('BEGIN');
  for (const name of ['001_initial','002_bookings','003_guest_booking','004_queue','005_whanau','006_visit_shop_integrity','007_queue_call_preview','008_reminders','009_reminder_deduplication','010_clients','011_fresha_import','012_booking_rules','013_booking_exception_unlimited','014_booking_rule_version','015_shop_onboarding','016_onboarding_test_clients','017_pilot_operations','018_operator_audit_retention','019_daily_reports','020_deposits','021_deposit_notice','022_shop_billing','023_billing_renewal_failure','024_rebooking_waitlist','025_checkout','026_checkout_receipt_integrity','027_salon_scheduling','028_salon_record_client','029_products_prepaid','030_prepaid_constraints','031_team_locations','032_team_concurrency','033_preserve_team_prices','034_retention_inbox','035_rotorua_directory','036_community_cut_days','037_community_assignment_cleanup','038_calendar_integrations','039_calendar_busy_guards','040_restore_test_booking_client_guard','041_whanau_organiser_phone','042_shop_street_address','043_staff_time_off','044_optional_cutover','045_salon_opt_in','046_staff_appearance','047_staff_activation','048_founding_beta','049_beta_message_tests','050_beta_message_integration','051_beta_plans','052_founder_feedback','053_support_reports','054_sms_billing_windows','055_owner_email_verification','056_regular_beta_approval','057_booking_email_outbox']) {
    const migration = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
    if (!migration.rowCount) { await client.query(readFileSync(new URL(`../db/${name}.sql`,import.meta.url),'utf8')); await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]); }
  }
  if (process.argv.includes('--seed')) {
    if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 8 || Buffer.byteLength(process.env.DEMO_PASSWORD,'utf8') > 72) throw new Error('Set DEMO_PASSWORD to at least 8 characters and at most 72 UTF-8 bytes before seeding.');
    const password = await bcrypt.hash(process.env.DEMO_PASSWORD, 12);
    const demoPhoto = readFileSync(new URL('../public/demo/rimu-barbers.png',import.meta.url));
    await client.query("INSERT INTO shops(id,name,location,accent,public_slug,photo,photo_type) SELECT 'rimu','Rimu Barbers','Rotorua','#184b3b','rimu',$1,'image/png' WHERE NOT EXISTS(SELECT 1 FROM shops WHERE id='rimu') ON CONFLICT DO NOTHING",[demoPhoto]);
    await client.query("INSERT INTO staff(id,email,password_hash,name) VALUES('demo','demo@rimu.example',$1,'Ari') ON CONFLICT DO NOTHING",[password]);
    await client.query("INSERT INTO memberships VALUES('demo','rimu') ON CONFLICT DO NOTHING");
    await client.query("INSERT INTO shop_owners(staff_id,shop_id) SELECT m.staff_id,m.shop_id FROM memberships m JOIN staff s ON s.id=m.staff_id WHERE m.staff_id='demo' AND m.shop_id='rimu' AND s.email='demo@rimu.example' ON CONFLICT DO NOTHING");
    await client.query("INSERT INTO directory_profiles(shop_id,opted_in,description,referral_secret) VALUES('rimu',true,'A friendly neighbourhood barbershop in Rotorua.', $1) ON CONFLICT(shop_id) DO NOTHING",[randomBytes(32).toString('hex')]);
    for (let day=0; day<7; day++) await client.query("INSERT INTO shop_hours VALUES('rimu',$1,$2,'09:00',$3) ON CONFLICT DO NOTHING",[day,day===0,day===6?'15:00':'17:30']);
    for (const s of [['standard','Standard cut','Classic cut and tidy.',4500,30],['fade','Skin fade','Fade, blend and finish.',5500,45],['kids','Kids cut','Aged 12 and under.',3500,20]]) await client.query("INSERT INTO services(id,shop_id,name,description,price_cents,duration) VALUES($1,'rimu',$2,$3,$4,$5) ON CONFLICT DO NOTHING",s);
    for (const [id,name,services] of [['ari','Ari',['standard','fade','kids']],['jordan','Jordan',['standard','fade']],['sam','Sam',['standard','kids']]]) {
      await client.query("INSERT INTO barbers(id,shop_id,name) SELECT $1,'rimu',$2 WHERE NOT EXISTS(SELECT 1 FROM barbers WHERE id=$1) ON CONFLICT DO NOTHING",[id,name]);
      for(const service of services) await client.query("INSERT INTO barber_services VALUES('rimu',$1,$2) ON CONFLICT DO NOTHING",[id,service]);
      for(let day=0;day<7;day++) await client.query("INSERT INTO shifts VALUES('rimu',$1,$2,$3,'09:00',$4) ON CONFLICT DO NOTHING",[id,day,day===0,day===6?'15:00':'17:30']);
    }
  }
  await client.query('COMMIT'); console.log(process.argv.includes('--seed') ? 'Migrations and demo seed complete.' : 'Migrations complete.');
} catch(e) { await client.query('ROLLBACK'); throw e; } finally { await client.end(); }
