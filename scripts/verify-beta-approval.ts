import './local-qa-guard.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {chromium} from 'playwright';
const base=`http://127.0.0.1:${process.env.QA_APP_PORT||'3003'}`,db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),owner=await b.newPage(),visitor=await b.newPage();
const post=(page:typeof owner,path:string,data:Record<string,unknown>)=>page.evaluate(async({path,data})=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,body:await r.json()}},{path,data});
const tag=randomUUID().slice(0,8),shop=`beta-${tag}`;
try{
 await db.query('INSERT INTO shops(id,name,location,public_slug) VALUES($1,$2,$3,$1)',[shop,'Fictional beta shop','Rotorua']);await db.query("INSERT INTO memberships(staff_id,shop_id) VALUES('demo',$1)",[shop]);await db.query("INSERT INTO shop_owners(staff_id,shop_id) VALUES('demo',$1)",[shop]);
 await visitor.goto(base+'/beta?kind=regular');assert.equal(new URL(visitor.url()).pathname,'/');const interest={id:randomUUID(),screen:'Beta',category:'idea',message:`Regular beta interest: Fictional shop ${tag}`,replyEmail:`${tag}@example.test`};assert.equal((await post(visitor,'/api/support',interest)).status,200);assert.equal((await post(visitor,'/api/support',interest)).status,200);
 await owner.goto(base+'/login');await owner.getByLabel('Email',{exact:true}).fill('demo@rimu.example');await owner.getByLabel('Password').fill(process.env.DEMO_PASSWORD!);await owner.getByRole('button',{name:'Sign in'}).click();await owner.waitForURL('**/today');
 assert.equal((await post(owner,'/api/beta',{action:'apply',shopId:shop,kind:'regular'})).status,200);assert.equal((await post(owner,'/api/beta',{action:'apply',shopId:shop,kind:'regular'})).status,200);
 assert.equal((await post(owner,'/api/beta',{action:'activate',shopId:shop})).status,400);
 const q=await owner.evaluate(async()=>await (await fetch('/api/beta/operator')).json());assert.equal(q.interest.filter((x:{shop_id:string})=>x.shop_id===shop).length,1);assert.equal(q.interest.filter((x:{contact_email:string})=>x.contact_email===`${tag}@example.test`).length,1);
 assert.equal((await post(owner,'/api/beta/operator',{action:'approveRegular',shopId:shop})).status,200);assert.equal((await post(owner,'/api/beta',{action:'activate',shopId:shop})).status,200);
 console.log('PASS: signed-in and signed-out interest in one queue; no activation before operator approval; repeat interest deduplicated.');
}finally{await b.close();await db.query('DELETE FROM support_reports WHERE reply_email=$1',[`${tag}@example.test`]);await db.query('DELETE FROM shops WHERE id=$1',[shop]);await db.end()}
