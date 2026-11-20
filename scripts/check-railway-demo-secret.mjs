import {readFileSync} from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
const suffix=process.argv[2]||'';
if(!['','.next','.previous'].includes(suffix))throw Error('Invalid local credential version.');
const expected=Buffer.from(readFileSync('.popin-railway-demo-password'+suffix,'utf8'));
const actual=Buffer.from(process.env.DEMO_PASSWORD||'');
const matches=actual.length===expected.length&&timingSafeEqual(actual,expected);
console.log(matches?'Railway demo password matches the private local file.':'Railway demo password does not match the private local file.');
if(!matches)process.exitCode=1;
