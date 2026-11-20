import {Temporal} from '@js-temporal/polyfill';
import {writeFile} from 'node:fs/promises';
import {db} from '../lib/db';
import {groupOptions,createVisit} from '../lib/visit';
import {joinQueue} from '../lib/queue';
const url=new URL(process.env.DATABASE_URL||'postgresql://invalid');if(url.hostname!=='127.0.0.1'||url.port!=='56441')throw Error('Use the isolated QA database.');
const now=Temporal.Now.plainDateISO('Pacific/Auckland'),date=now.add({days:((6-now.dayOfWeek+7)%7)||7}).toString(),people=[{name:'Luca Sample',serviceId:'qa-kids',expectedPrice:3500},{name:'Mia Whānau Sample',serviceId:'qa-kids',expectedPrice:3500}],options=await groupOptions('qa-rimu',people,date),option=options.options.find(x=>x.kind==='same');if(!option)throw Error('No visit fixture slot is available.');const visit=await createVisit({slug:'qa-rimu',date,people,option,email:'whanau-critic@example.test'}),queue=await joinQueue('qa-rimu',{firstName:'Wiremu Sample',mobile:'021 555 0199',serviceId:'qa-standard',barberId:''});await writeFile('.qa-critic-links.json',JSON.stringify({visit:`http://127.0.0.1:3003/visit#${visit.token}`,queue:`http://127.0.0.1:3003/queue-status#${queue.token}`},null,2));console.log('Created synthetic confirmed visit and waiting customer; private links saved only in the ignored QA file.');await db.end();
