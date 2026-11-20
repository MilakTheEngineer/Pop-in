import {runDueReminders} from '../lib/reminders';
import {db} from '../lib/db';
const url=new URL(process.env.DATABASE_URL||'postgresql://invalid');
if(process.env.NODE_ENV==='production'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){console.error('The preview worker only runs against a local development database.');process.exit(1)}
console.log('Pop-in reminder preview worker running. No messages will be sent. Press Ctrl+C to stop.');
let stopping=false;process.on('SIGINT',()=>{stopping=true});process.on('SIGTERM',()=>{stopping=true});
while(!stopping){try{const result=await runDueReminders(null);if(result.created)console.log(`Created ${result.created} local reminder preview(s).`)}catch(e){console.error('Reminder preview pass failed:',e)}for(let i=0;i<30&&!stopping;i++)await new Promise(resolve=>setTimeout(resolve,1000));}
await db.end();
