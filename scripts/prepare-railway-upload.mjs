import {cp,mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {createHash} from 'node:crypto';

// Build an explicit allow-list so local databases, credentials, screenshots and
// test fixtures can never be uploaded as part of a deployment.
const root=resolve('.'),dirs=['app','lib','db','public'],files=['package.json','package-lock.json','next.config.mjs','next-env.d.ts','tsconfig.json'];
const target=await mkdtemp(join(root,process.argv.includes('--check')?'.popin-railway-check-':'.popin-railway-upload-'));
for(const dir of dirs)await cp(join(root,dir),join(target,dir),{recursive:true,errorOnExist:true});
for(const file of files)await cp(join(root,file),join(target,file),{errorOnExist:true});
await mkdir(join(target,'scripts'));for(const script of ['setup.mjs','rotate-preview-demo.mjs'])await cp(join(root,'scripts',script),join(target,'scripts',script),{errorOnExist:true});
await writeFile(join(target,'.railwayignore'),'.next*\nnode_modules\n.env*\n*.tsbuildinfo\n*.log\n');
const entries=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isSymbolicLink())throw Error('Unexpected symlink in deployment: '+relative(target,p));if(e.isDirectory())await walk(p);else if(e.isFile())entries.push(relative(target,p).replaceAll('\\','/'))}}
await walk(target);entries.sort();const hash=createHash('sha256');for(const name of entries){hash.update(name);hash.update('\0');hash.update(await readFile(join(target,name)));hash.update('\0')}
console.log(JSON.stringify({directory:target,files:entries.length,archiveSourceSha256:hash.digest('hex'),included:[...dirs,...files,'scripts/setup.mjs','scripts/rotate-preview-demo.mjs','.railwayignore']}));
