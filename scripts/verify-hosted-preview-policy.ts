import assert from 'node:assert/strict';
import {confirmationPreview,demoEmailAllowed,hostedDemoEnabled} from '../lib/confirmation';

const keys=['NODE_ENV','POPIN_ENVIRONMENT','POPIN_REMOTE_PREVIEW','POPIN_PUBLIC_ORIGIN'] as const;
const env=process.env as Record<string,string|undefined>;
const saved=Object.fromEntries(keys.map(key=>[key,env[key]]));
const request=(origin:string)=>new Request(origin+'/api/guest',{headers:{origin}});
try{
 Object.assign(process.env,{NODE_ENV:'production',POPIN_ENVIRONMENT:'staging',POPIN_REMOTE_PREVIEW:'true',POPIN_PUBLIC_ORIGIN:'https://demo.example.test'});
 const demo=request('https://demo.example.test');
 assert.equal(hostedDemoEnabled(),true);
 assert.equal(confirmationPreview(demo,'rimu'),true);
 assert.equal(confirmationPreview(demo,'another-shop'),false);
 assert.equal(confirmationPreview(request('https://other.example.test'),'rimu'),false);
 assert.equal(demoEmailAllowed(demo,'rimu','tester@example.test'),true);
 assert.equal(demoEmailAllowed(demo,'rimu','tester@example.com'),false);
 process.env.POPIN_ENVIRONMENT='production';assert.equal(confirmationPreview(demo,'rimu'),false);
 process.env.POPIN_ENVIRONMENT='staging';process.env.POPIN_REMOTE_PREVIEW='false';assert.equal(confirmationPreview(demo,'rimu'),false);
 process.env.POPIN_REMOTE_PREVIEW='true';process.env.POPIN_PUBLIC_ORIGIN='http://demo.example.test';assert.equal(confirmationPreview(request('http://demo.example.test'),'rimu'),false);
 Object.assign(process.env,{NODE_ENV:'development',POPIN_REMOTE_PREVIEW:'false'});assert.equal(confirmationPreview(request('http://127.0.0.1:3003'),'another-shop'),true);
 console.log('PASS: hosted previews require the explicit staging flag, HTTPS origin, fictional shop and fictional email.');
}finally{for(const key of keys){const value=saved[key];if(value===undefined)delete env[key];else env[key]=value}}
