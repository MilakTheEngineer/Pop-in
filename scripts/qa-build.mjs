import {spawnSync} from 'node:child_process';
process.loadEnvFile('.env.qa');
const db=new URL(process.env.DATABASE_URL||'postgresql://invalid');
if(db.hostname!=='127.0.0.1'||db.port!=='56441')throw Error('Use the isolated QA database.');
process.env.POPIN_NEXT_DIST_DIR='.next-qa-build';
const build=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:process.env,windowsHide:true});
if(build.error)throw build.error;
process.exit(build.status??1);
