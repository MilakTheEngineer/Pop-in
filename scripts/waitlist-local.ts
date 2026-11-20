import {processOpenings} from '../lib/waitlist';
import {db} from '../lib/db';
const url=new URL(process.env.DATABASE_URL||'postgresql://invalid');
if(process.env.NODE_ENV==='production'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){console.error('The waitlist preview worker only runs against a local development database.');process.exit(1)}
console.log('Pop-in waitlist preview worker running. No messages will be sent. Press Ctrl+C to stop.');
let stopping=false;process.on('SIGINT',()=>{stopping=true});process.on('SIGTERM',()=>{stopping=true});
while(!stopping){try{const shops=await db.query('SELECT DISTINCT shop_id FROM waitlist_openings WHERE processed_at IS NULL');for(const shop of shops.rows)await processOpenings(shop.shop_id)}catch{console.error('Waitlist preview check failed; it will be retried.')}for(let i=0;i<15&&!stopping;i++)await new Promise(resolve=>setTimeout(resolve,1000))}
await db.end();
