import {spawn} from 'node:child_process';
process.loadEnvFile('.env.qa');
process.env.DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:56443/postgres';
process.env.POPIN_ENVIRONMENT='staging';
process.env.POPIN_OPERATOR_STAFF_ID='staging-operator';
process.env.POPIN_NEXT_DIST_DIR='.next-qa-staging2';
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-H','127.0.0.1','-p','3006'],{stdio:'inherit',env:process.env,windowsHide:true});
app.on('exit',(code)=>process.exit(code??1));
process.on('SIGINT',()=>app.kill('SIGINT'));
