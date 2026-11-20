import {runDueCampaigns} from '../lib/retention';
import {db} from '../lib/db';
const database=new URL(process.env.DATABASE_URL||'postgresql://invalid'),origin=process.env.POPIN_PUBLIC_ORIGIN||'http://127.0.0.1:3001';
let app:URL;try{app=new URL(origin)}catch{throw Error('Set POPIN_PUBLIC_ORIGIN to the local app origin.')}
if(process.env.NODE_ENV==='production'||!['localhost','127.0.0.1','[::1]'].includes(database.hostname)||!['localhost','127.0.0.1','[::1]'].includes(app.hostname)||app.origin!==origin){console.error('The campaign preview worker only runs against a local development database and app origin.');process.exit(1)}
console.log('Pop-in campaign preview worker running. No messages will be sent. Press Ctrl+C to stop.');
let stopping=false;process.on('SIGINT',()=>{stopping=true});process.on('SIGTERM',()=>{stopping=true});
while(!stopping){try{const r=await runDueCampaigns(origin);if(r.processed)console.log(`Created previews for ${r.processed} campaign(s).`)}catch{console.error('Campaign preview pass failed. Check local database access.')}for(let i=0;i<30&&!stopping;i++)await new Promise(resolve=>setTimeout(resolve,1000));}
await db.end();
