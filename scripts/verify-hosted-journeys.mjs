// The Railway preview was retired. Keep this old entry point safe and local.
import {spawnSync} from 'node:child_process';
const run=spawnSync(process.execPath,['scripts/qa-suite.mjs','verify-guest.mjs','verify-queue.ts','verify-whanau.mjs'],{stdio:'inherit',env:process.env,windowsHide:true});
if(run.error)throw run.error;
process.exit(run.status??1);
