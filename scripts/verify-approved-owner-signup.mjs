// Exercise real production-mode gates through a local HTTPS proxy. No hosted service or provider is used.
import './local-qa-guard.mjs';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import https from 'node:https';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {Temporal} from '@js-temporal/polyfill';
import {chromium} from 'playwright';
import pg from 'pg';

const database=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,query_timeout:15000});await database.connect();
const temporary=await mkdtemp(join(tmpdir(),'varello-approved-signup-'));
const port=Number(process.env.QA_SIGNUP_APP_PORT||3006),tlsPort=Number(process.env.QA_SIGNUP_HTTPS_PORT||3443);
const origin=`https://signup.example.test:${tlsPort}`,tag=randomUUID();
const staffEmail=`approved-staff-${tag}@example.test`;
const emails=[`approved-a-${tag}@example.test`,`approved-b-${tag}@example.test`,`approved-c-${tag}@example.test`],password='fictional signup password';
const deliveryReady=join(temporary,'delivery-ready');
const mailbox=join(temporary,'mailbox.jsonl'),preload=join(temporary,'fake-email.mjs');
const shops=[],checks=[];let app,proxy,browser;let appOutput='';
function record(message){checks.push(message);console.log('PASS: '+message)}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function stopApp(){if(!app)return;const process=app;app=undefined;process.kill('SIGTERM');await Promise.race([new Promise(resolve=>process.once('exit',resolve)),wait(3000)]);if(process.exitCode===null)process.kill('SIGKILL')}
async function startApp(extra={}){
 await stopApp();
 const env={PATH:process.env.PATH,NODE_ENV:'production',NODE_OPTIONS:`--import=${preload}`,DATABASE_URL:process.env.DATABASE_URL,POPIN_ENVIRONMENT:'local',POPIN_OPERATOR_STAFF_ID:'demo',POPIN_NEXT_DIST_DIR:process.env.QA_SIGNUP_DIST_DIR||'.next-qa-build',POPIN_PUBLIC_ORIGIN:origin,POPIN_OWNER_SIGNUP_ALLOWED_EMAILS:emails.join(','),RESEND_API_KEY:'fictional-fake-delivery-only',POPIN_EMAIL_FROM:'Varello <test@example.test>',...extra};
 app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{env,stdio:['ignore','pipe','pipe']});
 app.stdout.on('data',value=>appOutput+=value);app.stderr.on('data',value=>appOutput+=value);
 for(let i=0;i<100;i++){if(app.exitCode!==null)throw Error('Local production app failed to start');try{if((await fetch(`http://127.0.0.1:${port}/login`,{signal:AbortSignal.timeout(1000)})).ok)return}catch{}await wait(100)}throw Error('Local production app readiness timed out');
}
async function post(page,path,data){return page.evaluate(async({path,data})=>{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});return {status:response.status,body:await response.json()}},{path,data})}
function signup(email){return {action:'signup',name:'Fictional owner',email,password,shopName:'Fictional approved signup',streetAddress:'1 Fictional Street',location:'Rotorua'}}
try{
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(temporary,'key.pem'),'-out',join(temporary,'cert.pem'),'-days','1','-subj','/CN=signup.example.test'],{stdio:'ignore'});
 await writeFile(preload,`import {appendFile} from 'node:fs/promises';\nimport {existsSync} from 'node:fs';\nimport {randomUUID} from 'node:crypto';\nconst target=new URL(process.env.DATABASE_URL);if(target.hostname!=='127.0.0.1'||process.env.POPIN_ENVIRONMENT!=='local')throw Error('Fake email requires isolated localhost QA');\nconst original=globalThis.fetch;globalThis.fetch=async(input,init)=>{const url=String(input instanceof Request?input.url:input);if(url==='https://api.resend.com/emails'){const body=JSON.parse(String(init?.body));if(!body.to.every(address=>/^[^\\s@]+@example\\.test$/.test(address)))throw Error('Fictional recipients only');if(body.to.includes('signup-customer@example.test')&&!existsSync(${JSON.stringify(deliveryReady)}))return new Response('Synthetic provider not ready',{status:503});await appendFile(${JSON.stringify(mailbox)},JSON.stringify(body)+'\\n');return Response.json({id:'fake-'+randomUUID()})}if(new URL(url).hostname==='127.0.0.1')return original(input,init);throw Error('External fetch blocked by QA');};\n`);
 proxy=https.createServer({key:await readFile(join(temporary,'key.pem')),cert:await readFile(join(temporary,'cert.pem'))},(request,response)=>{const upstream=http.request({hostname:'127.0.0.1',port,path:request.url,method:request.method,headers:{...request.headers,'x-forwarded-proto':'https','x-forwarded-host':request.headers.host}},result=>{response.writeHead(result.statusCode,result.headers);result.pipe(response)});upstream.on('error',()=>{response.writeHead(502);response.end()});request.pipe(upstream)});
 await new Promise(resolve=>proxy.listen(tlsPort,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--host-resolver-rules=MAP signup.example.test 127.0.0.1','--no-proxy-server']});
 const contexts=await Promise.all([0,1,2,3,4,5,6].map(()=>browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}})));
 const [ownerA,ownerB,guest,employee,ownerC,operator,employeeB]=await Promise.all(contexts.map(context=>context.newPage()));for(const page of [ownerA,ownerB,guest,employee,ownerC,operator,employeeB])page.setDefaultTimeout(15000);
 await startApp();await guest.goto(origin+'/beta');assert.equal(await guest.getByRole('link',{name:'Create your private shop'}).count(),0);await guest.goto(origin+'/setup');await guest.getByRole('heading',{name:'Shop setup is by invitation'}).waitFor();
 assert.equal((await post(guest,'/api/onboarding',signup(emails[0]))).status,403);assert.equal((await database.query('SELECT count(*)::int AS n FROM staff WHERE email=ANY($1::text[])',[emails])).rows[0].n,0);record('default-off UI/API; no account created');
 await startApp({POPIN_OWNER_SIGNUP_ENABLED:'true'});
 await guest.goto(origin+'/setup');assert.equal((await post(guest,'/api/onboarding',signup(`unapproved-${tag}@example.test`))).status,403);record('unapproved registration email rejected');
 for(const [index,page] of [ownerA,ownerB,ownerC].entries()){
  await page.goto(origin+'/');await page.getByRole('link',{name:'Register beta interest',exact:true}).first().click();await page.getByRole('link',{name:'Create your private shop'}).click();
  await page.getByLabel('Your name').fill('Fictional owner');await page.getByLabel('Email address').fill(emails[index]);await page.getByLabel('Password').fill(password);await page.getByLabel('Shop name').fill(`Fictional owner ${index}`);await page.getByLabel('Street address').fill('1 Fictional Street');await page.getByLabel('Town/city').fill('Rotorua');await page.getByRole('button',{name:'Create shop'}).click();await page.waitForURL('**/onboarding');
  const shop=(await database.query('SELECT s.id,s.public_slug,s.booking_published,u.id AS owner_id,u.email_verified_at FROM shops s JOIN shop_owners o ON o.shop_id=s.id JOIN staff u ON u.id=o.staff_id WHERE u.email=$1',[emails[index]])).rows[0];assert.ok(shop);shops.push(shop);assert.equal(shop.booking_published,false);assert.equal(shop.email_verified_at,null);
  for(const path of ['book','queue','whanau']){const response=await guest.goto(`${origin}/${path}/${shop.public_slug}`);assert.equal(response.status(),404)}
  assert.equal((await post(page,'/api/onboarding',{action:'publish',shopId:shop.id})).status,403);assert.equal((await post(page,'/api/onboarding',{action:'invite',shopId:shop.id,email:`staff-${index}@example.test`})).status,403);
  await page.getByRole('button',{name:'Send verification link'}).click();await page.getByRole('status').filter({hasText:'Verification email requested'}).waitFor();
  const messages=(await readFile(mailbox,'utf8')).trim().split('\n').map(JSON.parse);const message=messages.find(message=>message.to.includes(emails[index]));assert.ok(message);const link=message.text.match(/https:\/\/[^\s]+/)[0];await guest.goto(link);await guest.getByRole('button',{name:'Verify email',exact:true}).click();await guest.getByRole('status').waitFor();
  await page.reload();await page.getByText(`${emails[index]} · Verified`,{exact:true}).waitFor();assert.equal((await post(page,'/api/onboarding',{action:'publish',shopId:shop.id})).status,403);
 }
 record('public site → approved setup → three unverified private drafts → fake-inbox verification; anonymous routes hidden and launch/invites still denied');
 assert.equal((await database.query('SELECT count(*)::int AS n FROM booking_email_outbox WHERE shop_id=ANY($1::text[])',[shops.map(shop=>shop.id)])).rows[0].n,0);
 const [a,b,c]=shops;
 await operator.goto(origin+'/login');await operator.getByLabel('Email',{exact:true}).fill('demo@rimu.example');await operator.getByLabel('Password',{exact:true}).fill(process.env.DEMO_PASSWORD);await operator.getByRole('button',{name:'Sign in'}).click();await operator.waitForURL('**/today');
 assert.equal((await post(ownerA,'/api/beta/operator',{action:'approveLaunch',shopId:a.id})).status,403);
 await operator.goto(origin+'/operator');const card=operator.locator('article').filter({hasText:'Fictional owner 0 · Rotorua'});await card.getByRole('button',{name:'Approve shop to go live'}).click();await operator.getByRole('status').filter({hasText:'Shop approved to go live'}).waitFor();
 assert.equal((await database.query('SELECT booking_published FROM shops WHERE id=$1',[a.id])).rows[0].booking_published,false);
 const capped=await post(ownerA,'/api/onboarding',{action:'invite',shopId:a.id,email:staffEmail});assert.equal(capped.status,400);assert.match(capped.body.error,/Free includes 1 person/);assert.equal((await database.query('SELECT count(*)::int AS n FROM shop_invitations WHERE shop_id=$1',[a.id])).rows[0].n,0);
 await ownerA.reload();await ownerA.getByRole('button',{name:'Invite staff',exact:true}).click();await ownerA.getByText(/Free includes 1 person/).waitFor();assert.equal(await ownerA.getByRole('button',{name:'Create invitation'}).isDisabled(),true);
 record('operator-only approval is separate from publication; Free rejects invite before token creation and explains capacity in owner UI');
 // Multi-person employee QA uses explicit fictional Pro entitlement, never a Founder seat.
 await database.query("UPDATE location_groups SET plan_code='pro' WHERE id=(SELECT location_group_id FROM shops WHERE id=$1)",[a.id]);
 // Real production gates, fake transport only; no recipient allowlist bypass.
 await startApp({POPIN_OWNER_SIGNUP_ENABLED:'true',POPIN_OWNER_RECOVERY_ENABLED:'true',POPIN_PILOT_SHOP_ID:a.id,POPIN_PILOT_RESTORE_VERIFIED:'true',POPIN_BOOKING_EMAIL_ENABLED:'true',POPIN_BOOKING_EMAIL_KEY:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='});
 assert.equal((await post(ownerB,'/api/onboarding',{action:'publish',shopId:b.id})).status,403);assert.equal((await post(ownerB,'/api/onboarding',{action:'invite',shopId:b.id,email:'blocked-staff@example.test'})).status,403);
 const invitation=await post(ownerA,'/api/onboarding',{action:'invite',shopId:a.id,email:staffEmail});assert.equal(invitation.status,200);
 await employee.goto(invitation.body.inviteUrl);await employee.getByLabel('Your name').fill('Fictional employee');await employee.getByLabel('Password').fill(password);await employee.getByRole('button',{name:'Accept invitation'}).click();await employee.waitForURL('**/today');await employee.getByRole('heading',{name:'Today',exact:true}).waitFor();assert.equal((await post(employee,'/api/onboarding',{action:'publish',shopId:a.id})).status,403);

 // Existing fixture records make the approved shop ready without bypassing the publish endpoint.
 const service='signup-service-'+tag,barber='signup-barber-'+tag;
 await database.query('INSERT INTO services(id,shop_id,name,duration,price_cents) VALUES($1,$2,$3,30,4500)',[service,a.id,'Fictional cut']);await database.query('INSERT INTO barbers(id,shop_id,name) VALUES($1,$2,$3)',[barber,a.id,'Fictional barber']);await database.query('INSERT INTO barber_services VALUES($1,$2,$3)',[a.id,barber,service]);
 for(let day=0;day<7;day++){await database.query("INSERT INTO shop_hours VALUES($1,$2,false,'09:00','17:00')",[a.id,day]);await database.query("INSERT INTO shifts VALUES($1,$2,$3,false,'09:00','17:00')",[a.id,barber,day])}
 const date=Temporal.Now.plainDateISO('Pacific/Auckland').add({days:7}).toString(),booking={action:'book',slug:a.public_slug,barberId:barber,serviceId:service,expectedPrice:4500,date,time:'09:00',customer:'Fictional signup test',email:'signup-customer@example.test'};
 assert.equal((await post(ownerA,'/api/guest',{...booking,test:true})).status,200);assert.equal((await post(ownerA,'/api/onboarding',{action:'publish',shopId:a.id})).status,200);
 const aPublic=await guest.goto(`${origin}/book/${a.public_slug}`);assert.equal(aPublic.status(),200);const firstBooking=await post(guest,'/api/guest',{...booking,time:'10:00'});assert.equal(firstBooking.status,200);
 assert.equal((await guest.goto(`${origin}/book/${b.public_slug}`)).status(),404);assert.equal((await database.query('SELECT booking_published FROM shops WHERE id=$1',[b.id])).rows[0].booking_published,false);assert.equal((await database.query('SELECT count(*)::int AS n FROM shop_invitations WHERE shop_id=$1',[b.id])).rows[0].n,0);assert.equal((await database.query('SELECT count(*)::int AS n FROM booking_email_outbox WHERE shop_id=$1',[b.id])).rows[0].n,0);
 record('verified Pro shop A redeems an employee invite, publishes and books; verified unapproved shops remain private');
 // Approving B leaves A approved. C remains denied, even with a matching legacy pin.
 assert.equal((await post(operator,'/api/beta/operator',{action:'approveLaunch',shopId:b.id})).status,200);
 await database.query("UPDATE location_groups SET plan_code='pro' WHERE id=(SELECT location_group_id FROM shops WHERE id=$1)",[b.id]);
 const bService='second-service-'+tag,bBarber='second-barber-'+tag;
 await database.query('INSERT INTO services(id,shop_id,name,duration,price_cents) VALUES($1,$2,$3,30,4500)',[bService,b.id,'Fictional second cut']);await database.query('INSERT INTO barbers(id,shop_id,name) VALUES($1,$2,$3)',[bBarber,b.id,'Fictional second barber']);await database.query('INSERT INTO barber_services VALUES($1,$2,$3)',[b.id,bBarber,bService]);
 for(let day=0;day<7;day++){await database.query("INSERT INTO shop_hours VALUES($1,$2,false,'09:00','17:00')",[b.id,day]);await database.query("INSERT INTO shifts VALUES($1,$2,$3,false,'09:00','17:00')",[b.id,bBarber,day])}
 const secondInvite=await post(ownerB,'/api/onboarding',{action:'invite',shopId:b.id,email:'second-'+staffEmail,barberId:bBarber});assert.equal(secondInvite.status,200);
 const bBooking={...booking,slug:b.public_slug,barberId:bBarber,serviceId:bService,customer:'Fictional second customer'};
 assert.equal((await post(ownerB,'/api/guest',{...bBooking,customer:'Fictional setup rehearsal',test:true})).status,200);assert.equal((await post(ownerB,'/api/onboarding',{action:'publish',shopId:b.id})).status,200);
 const secondBooking=await post(guest,'/api/guest',{...bBooking,time:'10:00'});assert.equal(secondBooking.status,200);
 // The fake provider refuses customer delivery until released below.
 assert.equal((await database.query("SELECT count(*)::int AS n FROM booking_email_outbox WHERE shop_id=ANY($1::text[]) AND event='confirmation' AND state='pending'",[[a.id,b.id]])).rows[0].n,2);
 // Hold queued confirmations across restart so delivery is checked after intake/pin changes.
 await database.query("UPDATE booking_email_outbox SET lease_until=now()+interval '1 hour' WHERE shop_id=ANY($1::text[]) AND state='pending'",[[a.id,b.id]]);
 await startApp({POPIN_OWNER_SIGNUP_ENABLED:'true',POPIN_OWNER_RECOVERY_ENABLED:'true',POPIN_ENROLMENTS_PAUSED:'true',POPIN_PILOT_SHOP_ID:c.id,POPIN_PILOT_RESTORE_VERIFIED:'true',POPIN_BOOKING_EMAIL_ENABLED:'true',POPIN_BOOKING_EMAIL_KEY:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='});
 for(const action of ['publish','invite'])assert.equal((await post(ownerC,'/api/onboarding',{action,shopId:c.id,email:'blocked@example.test'})).status,403);
 assert.equal((await guest.goto(`${origin}/book/${c.public_slug}`)).status(),404);assert.equal((await post(guest,'/api/guest',{...booking,slug:c.public_slug})).status,400);
 assert.equal((await database.query('SELECT count(*)::int AS n FROM booking_email_outbox WHERE shop_id=$1',[c.id])).rows[0].n,0);
 await employeeB.goto(secondInvite.body.inviteUrl);await employeeB.getByLabel('Your name').fill('Fictional second employee');await employeeB.getByLabel('Password').fill(password);await employeeB.getByRole('button',{name:'Accept invitation'}).click();await employeeB.waitForURL('**/today');
 await employeeB.context().clearCookies();await employeeB.goto(origin+'/login');await employeeB.getByLabel('Email',{exact:true}).fill('second-'+staffEmail);await employeeB.getByLabel('Password',{exact:true}).fill(password);await employeeB.getByRole('button',{name:'Sign in'}).click();await employeeB.waitForURL('**/today');
 await employeeB.goto(origin+'/calendar');await employeeB.getByLabel('Calendar date').fill(date);await employeeB.getByLabel('Barber filter').selectOption(bBarber);await employeeB.locator('.timeline-event').filter({hasText:'Fictional second customer'}).waitFor();
 assert.equal((await database.query('SELECT count(*)::int AS n FROM staff_barber_links l JOIN staff u ON u.id=l.staff_id WHERE u.email=$1 AND l.barber_id=$2',['second-'+staffEmail,bBarber])).rows[0].n,1);
 for(const [saved,details] of [[firstBooking,booking],[secondBooking,bBooking]]){
  const token=saved.body.token;assert.equal((await post(guest,'/api/guest',{action:'lookup',token})).status,200);assert.equal((await post(guest,'/api/guest',{action:'move',token,date,time:'11:00',barberId:details.barberId})).status,200);assert.equal((await post(guest,'/api/guest',{action:'cancel',token})).status,200);
  const slots=await post(guest,'/api/guest',{action:'slots',slug:details.slug,serviceId:details.serviceId,barberId:details.barberId,date});assert.ok(slots.body.slots.some(slot=>slot.time==='11:00'));
 }
 await employeeB.reload();await employeeB.getByLabel('Calendar date').fill(date);await employeeB.getByLabel('Barber filter').selectOption(bBarber);await employeeB.locator('.timeline-event').filter({hasText:'Fictional second customer'}).waitFor({state:'hidden'});
 await database.query("UPDATE booking_email_outbox SET lease_until=NULL WHERE shop_id=ANY($1::text[]) AND state='pending'",[[a.id,b.id]]);
 await writeFile(deliveryReady,'ready');
 // Restart triggers the existing worker immediately; its transport is intercepted by the fake inbox.
 await startApp({POPIN_OWNER_SIGNUP_ENABLED:'true',POPIN_OWNER_RECOVERY_ENABLED:'true',POPIN_ENROLMENTS_PAUSED:'true',POPIN_PILOT_SHOP_ID:c.id,POPIN_PILOT_RESTORE_VERIFIED:'true',POPIN_BOOKING_EMAIL_ENABLED:'true',POPIN_BOOKING_EMAIL_KEY:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='});
 for(let i=0;i<100;i++){const pending=(await database.query("SELECT count(*)::int AS n FROM booking_email_outbox WHERE shop_id=ANY($1::text[]) AND state!='sent'",[[a.id,b.id]])).rows[0].n;if(!pending)break;await wait(100)}
 assert.equal((await database.query("SELECT count(*)::int AS n FROM booking_email_outbox WHERE shop_id=ANY($1::text[]) AND state!='sent'",[[a.id,b.id]])).rows[0].n,0);
 const delivered=(await readFile(mailbox,'utf8')).trim().split('\n').map(JSON.parse).filter(mail=>mail.to.includes('signup-customer@example.test'));assert.equal(delivered.length,6);assert.equal(delivered.filter(mail=>mail.subject==='Your booking is confirmed').length,2);assert.ok(delivered.filter(mail=>mail.subject==='Your booking is confirmed').every(mail=>/https:\/\/[^\s]+\/manage#[a-f0-9]{64}/.test(mail.text)));
 record('two approved shops independently invite/publish/book; pin switched to private C grants nothing; intake pause preserves old invite redemption, staff sign-in/assigned calendar, manage move/cancel/slot restoration and six fake delivered messages');

 // Exercise optional owner recovery through the same fake inbox, without changing shop approval.
 await guest.goto(origin+'/login');await guest.getByRole('link',{name:'Recover owner account'}).click();
 const unknown=await post(guest,'/api/owner-recovery',{action:'request',email:'unknown@example.test'});assert.equal(unknown.status,200);
 await guest.getByLabel('Owner email').fill(emails[0]);await guest.getByRole('button',{name:'Send recovery link'}).click();await guest.getByRole('status').filter({hasText:unknown.body.message}).waitFor();
 const recoveryMail=(await readFile(mailbox,'utf8')).trim().split('\n').map(JSON.parse).find(message=>message.to.includes(emails[0])&&message.subject==='Recover your Varello owner account');assert.ok(recoveryMail);
 const recoveryLink=recoveryMail.text.match(/https:\/\/[^\s]+/)[0],recoveryToken=new URL(recoveryLink).hash.slice(1),newPassword=' changed fictional password ';
 await guest.goto(recoveryLink);await guest.getByLabel('New password').fill(newPassword);await guest.getByRole('button',{name:'Update password'}).click();await guest.getByRole('heading',{name:'Password updated'}).waitFor();assert.equal(new URL(guest.url()).hash,'');
 await ownerA.goto(origin+'/onboarding');await ownerA.waitForURL('**/login');await ownerA.getByLabel('Email',{exact:true}).fill(emails[0]);await ownerA.getByLabel('Password',{exact:true}).fill(password);await ownerA.getByRole('button',{name:'Sign in'}).click();await ownerA.waitForURL('**/login?error=1');
 await ownerA.getByLabel('Email',{exact:true}).fill(emails[0]);await ownerA.getByLabel('Password',{exact:true}).fill(newPassword);await ownerA.getByRole('button',{name:'Sign in'}).click();await ownerA.waitForURL('**/today');
 assert.equal((await post(guest,'/api/owner-recovery',{action:'reset',token:recoveryToken,password})).status,400);await ownerB.goto(origin+'/onboarding');await ownerB.getByText(`${emails[1]} · Verified`,{exact:true}).waitFor();
 record('fake-inbox recovery: generic request response, one-use reset, old session revoked, old password rejected, exact new password accepted, other owner unaffected');
 await startApp({POPIN_OWNER_SIGNUP_ENABLED:'true',POPIN_ENROLMENTS_PAUSED:'true'});await guest.goto(origin+'/setup');await guest.getByRole('heading',{name:'Shop setup is by invitation'}).waitFor();assert.equal((await post(guest,'/api/onboarding',signup(emails[0]))).status,403);record('enrolment pause overrides registration enablement');
 const recoveryCount=(await database.query('SELECT count(*)::int AS n FROM owner_password_recovery_tokens WHERE staff_id=$1',[a.owner_id])).rows[0].n;
 await guest.goto(origin+'/login');assert.equal(await guest.getByRole('link',{name:'Recover owner account'}).count(),0);assert.deepEqual((await post(guest,'/api/owner-recovery',{action:'request',email:emails[0]})).body,unknown.body);assert.equal((await database.query('SELECT count(*)::int AS n FROM owner_password_recovery_tokens WHERE staff_id=$1',[a.owner_id])).rows[0].n,recoveryCount);record('recovery defaults off independently and does not issue a token for an existing verified owner');
 console.log('PASS: '+checks.join('; ')+'. Fake delivery only.');
}finally{
 await browser?.close();await stopApp();if(proxy){proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve))}
 const ids=shops.map(shop=>shop.id);await database.query('DELETE FROM schedule_entries WHERE shop_id=ANY($1::text[])',[ids]);await database.query('DELETE FROM schedule_resources WHERE shop_id=ANY($1::text[])',[ids]);await database.query('DELETE FROM shops WHERE id=ANY($1::text[])',[ids]);await database.query('DELETE FROM staff WHERE email=ANY($1::text[])',[[...emails,staffEmail,'second-'+staffEmail]]);await database.end();
 await mkdir('artifacts/qa-20261123',{recursive:true});await writeFile('artifacts/qa-20261123/approved-owner-signup.json',JSON.stringify({checks},null,2)+'\n');await writeFile('artifacts/qa-20261123/approved-owner-signup-server.log',appOutput);await rm(temporary,{recursive:true,force:true});
}
