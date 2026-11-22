import './local-qa-guard.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../lib/db';
import {pilotInvitesEnabled,pilotPublishingEnabled} from '../lib/pilot';
import {enqueueBookingEmail} from '../lib/booking-email-outbox';

const id=randomUUID();
const old=(await db.query("SELECT email_verified_at,verified_email FROM staff WHERE id='demo'")).rows[0];
try {
 process.env.POPIN_PILOT_SHOP_ID='rimu';
 process.env.POPIN_PUBLIC_ORIGIN='https://pilot.example.test';
 process.env.POPIN_BOOKING_EMAIL_ENABLED='true';
 process.env.POPIN_BOOKING_EMAIL_KEY='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
 process.env.RESEND_API_KEY='fictional-provider-key';
 process.env.POPIN_EMAIL_FROM='test@example.test';
 delete process.env.POPIN_BOOKING_EMAIL_TEST;
 delete process.env.POPIN_BOOKING_EMAIL_ALLOWED_RECIPIENTS;
 delete process.env.POPIN_PILOT_RESTORE_VERIFIED;
 await db.query("UPDATE staff SET email_verified_at=NULL,verified_email=NULL WHERE id='demo'");
 assert.equal(await pilotInvitesEnabled('rimu','demo'),false);
 await db.query("UPDATE staff SET email_verified_at=now(),verified_email=email WHERE id='demo'");
 assert.equal(await pilotInvitesEnabled('rimu','demo'),true);
 assert.equal(await pilotInvitesEnabled('other-shop','demo'),false);
 assert.equal(await pilotPublishingEnabled('rimu','demo'),false);
 process.env.POPIN_PILOT_RESTORE_VERIFIED='true';
 assert.equal(await pilotPublishingEnabled('rimu','demo'),true);
 assert.equal(await pilotPublishingEnabled('other-shop','demo'),false);
 const email={to:'customer@example.test',subject:'Fictional',text:'Fictional'};
 await enqueueBookingEmail(db,{shopId:'rimu',subjectType:'booking',subjectId:id,event:'confirmation',eventKey:id,email});
 assert.equal((await db.query('SELECT count(*)::int AS n FROM booking_email_outbox WHERE event_key=$1',[id])).rows[0].n,1);
 delete process.env.POPIN_PILOT_RESTORE_VERIFIED;
 await assert.rejects(()=>enqueueBookingEmail(db,{shopId:'rimu',subjectType:'booking',subjectId:id,event:'confirmation',eventKey:'denied-'+id,email}));
 console.log('PASS: verified owner, single shop, restore and booking-email gates. No provider used.');
} finally {
 await db.query('DELETE FROM booking_email_outbox WHERE event_key=$1',[id]);
 await db.query("UPDATE staff SET email_verified_at=$1,verified_email=$2 WHERE id='demo'",[old.email_verified_at,old.verified_email]);
 await db.end();
}
