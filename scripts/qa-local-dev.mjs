import {spawn} from 'node:child_process';

const target=new URL(process.env.DATABASE_URL||'postgresql://invalid');
for(const name of ['QA_DB_PORT','QA_APP_PORT']){const value=process.env[name];if(value&&(!/^\d{1,5}$/.test(value)||Number(value)<1||Number(value)>65535))throw Error(`Invalid ${name}.`)}
if(target.hostname!=='127.0.0.1'||target.port!==(process.env.QA_DB_PORT||'56441')||process.env.POPIN_ENVIRONMENT!=='local')throw Error('Use the isolated local QA database on QA_DB_PORT (default 56441).');
const env={...process.env,POPIN_OPERATOR_STAFF_ID:'demo',POPIN_NEXT_DIST_DIR:'.next-qa-local',POPIN_REMOTE_PREVIEW:'false',POPIN_PUBLIC_ORIGIN:`http://127.0.0.1:${process.env.QA_APP_PORT||'3003'}`};
for(const key of Object.keys(env))if(/^(RESEND|WEBSMS|STRIPE|POPIN_GOOGLE|POPIN_CALENDAR_TOKEN)/i.test(key))delete env[key];
delete env.POPIN_BOOKING_EMAIL_ENABLED;
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-H','127.0.0.1','-p',process.env.QA_APP_PORT||'3003'],{stdio:'inherit',env,windowsHide:true});
app.on('exit',code=>process.exit(code??1));
process.on('SIGINT',()=>app.kill('SIGINT'));
