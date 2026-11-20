import {db} from '../lib/db';
import {syncCalendar} from '../lib/calendar';

// Run as a separate process. Only previously authorised connections are used.
async function run(){const rows=(await db.query("SELECT id,shop_id FROM calendar_integrations WHERE status IN ('connected','error') ORDER BY updated_at LIMIT 500")).rows;let ok=0,failed=0;for(const row of rows){try{await syncCalendar(row.shop_id,row.id);ok++}catch{failed++}}console.log(`Calendar sync: ${ok} succeeded, ${failed} failed.`)}
let stop=false;process.on('SIGINT',()=>{stop=true});process.on('SIGTERM',()=>{stop=true});do{await run();if(process.argv.includes('--once'))break;for(let i=0;i<60&&!stop;i++)await new Promise(resolve=>setTimeout(resolve,1000))}while(!stop);await db.end();
