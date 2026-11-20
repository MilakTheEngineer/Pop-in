import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const roots=['app','lib','db'],files=[];
async function collect(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await collect(path);else if(entry.isFile())files.push(path)}}
for(const directory of roots)await collect(directory);files.push('package.json','next.config.mjs');files.sort((a,b)=>a.replaceAll('\\','/').localeCompare(b.replaceAll('\\','/'),'en'));
const hash=createHash('sha256');for(const file of files){hash.update(file.replaceAll('\\','/'));hash.update('\0');hash.update(await readFile(file));hash.update('\0')}
const result={sourceSha256:hash.digest('hex'),algorithm:'SHA-256 of sorted relative path, NUL, file contents, NUL',scope:[...roots,'package.json','next.config.mjs'],files:files.length,gitCommit:null,note:'Local synthetic QA build; this working tree has no Git commit.'};
await writeFile('artifacts/qa-20261121/round4-build.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
