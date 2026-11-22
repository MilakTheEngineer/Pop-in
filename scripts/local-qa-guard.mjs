// All database-backed QA checks must use a separate loopback test database.
const target=new URL(process.env.DATABASE_URL||'postgresql://invalid');
for(const name of ['QA_DB_PORT','QA_APP_PORT','QA_WEBHOOK_PORT']){const value=process.env[name];if(value&&(!/^\d{1,5}$/.test(value)||Number(value)<1||Number(value)>65535))throw new Error(`Invalid ${name}.`)}
if(target.hostname!=='127.0.0.1'||target.port!==(process.env.QA_DB_PORT||'56441')||!['local','staging'].includes(process.env.POPIN_ENVIRONMENT)){
 throw new Error('QA requires the separate localhost database on QA_DB_PORT (default 56441) and a local or staging test environment.');
}
for(const key of Object.keys(process.env))if(/^(RESEND|WEBSMS|STRIPE|POPIN_GOOGLE|POPIN_CALENDAR_TOKEN)/i.test(key))delete process.env[key];
delete process.env.POPIN_BOOKING_EMAIL_ENABLED;
process.env.POPIN_REMOTE_PREVIEW='false';
process.env.POPIN_PUBLIC_ORIGIN=`http://127.0.0.1:${process.env.QA_APP_PORT||'3003'}`;
