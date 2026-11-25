import './local-qa-guard.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../lib/db';
import {pilotInvitesEnabled,pilotPublishingEnabled} from '../lib/pilot';
import {enqueueBookingEmail} from '../lib/booking-email-outbox';
const tag=randomUUID(),shops=[`gate-a-${tag}`,`gate-b-${tag}`,`gate-draft-${tag}`],owner=`gate-owner-${tag}`;
try {
 process.env.POPIN_PUBLIC_ORIGIN='https://pilot.example.test';
 process.env.POPIN_BOOKING_EMAIL_ENABLED='true';
 process.env.POPIN_BOOKING_EMAIL_KEY='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
 process.env.RESEND_API_KEY='fictional-provider-key';process.env.POPIN_EMAIL_FROM='test@example.test';
 delete process.env.POPIN_BOOKING_EMAIL_TEST;delete process.env.POPIN_PILOT_RESTORE_VERIFIED;
 await db.query("INSERT INTO staff(id,email,name,password_hash) VALUES($1,$2,'Fictional verified owner','not-a-login-hash')",[owner,`${owner}@example.test`]);
 for(const id of shops){await db.query('INSERT INTO shops(id,name,location,public_slug) VALUES($1,$1,\'Rotorua\',$1)',[id]);await db.query('INSERT INTO memberships(staff_id,shop_id) VALUES($1,$2)',[owner,id]);await db.query('INSERT INTO shop_owners(staff_id,shop_id) VALUES($1,$2)',[owner,id])}
 assert.equal(await pilotInvitesEnabled(shops[0],owner),false);
 await db.query('UPDATE staff SET email_verified_at=now(),verified_email=email WHERE id=$1',[owner]);
 assert.equal(await pilotInvitesEnabled(shops[0],owner),true,'verified owner can invite without operator approval');
 assert.equal(await pilotInvitesEnabled(shops[1],owner),true);
 assert.equal(await pilotInvitesEnabled(shops[0],'demo'),false,'another owner cannot act in this shop');
 assert.equal(await pilotPublishingEnabled(shops[0],owner),false,'restore readiness still required');
 await db.query('DELETE FROM shop_owners WHERE shop_id=$1',[shops[2]]);
 process.env.POPIN_PILOT_RESTORE_VERIFIED='true';process.env.POPIN_ENROLMENTS_PAUSED='true';process.env.POPIN_PILOT_SHOP_ID='unrelated';
 const email={to:'customer@example.test',subject:'Fictional',text:'Fictional'};
 for(const shopId of shops.slice(0,2)) {assert.equal(await pilotPublishingEnabled(shopId,owner),true);await enqueueBookingEmail(db,{shopId,subjectType:'booking',subjectId:tag,event:'confirmation',eventKey:shopId,email})}
 assert.equal((await db.query('SELECT count(*)::int n FROM booking_email_outbox WHERE shop_id=ANY($1::text[])',[shops])).rows[0].n,2);
 assert.equal(await pilotPublishingEnabled(shops[2],owner),false,'membership alone cannot publish');
 await assert.rejects(()=>enqueueBookingEmail(db,{shopId:shops[2],subjectType:'booking',subjectId:tag,event:'confirmation',eventKey:shops[2],email}),/not ready/);
 delete process.env.POPIN_PILOT_RESTORE_VERIFIED;
 await assert.rejects(()=>enqueueBookingEmail(db,{shopId:shops[0],subjectType:'booking',subjectId:tag,event:'confirmation',eventKey:'denied-'+tag,email}),/not ready/);
 console.log('PASS: verified-owner self-service, two shops independently eligible, owner/location isolation, signup pause independence and restore/email readiness. No provider calls.');
} finally {await db.query('DELETE FROM booking_email_outbox WHERE shop_id=ANY($1::text[])',[shops]);await db.query('DELETE FROM shops WHERE id=ANY($1::text[])',[shops]);await db.query('DELETE FROM staff WHERE id=$1',[owner]);await db.end()}
