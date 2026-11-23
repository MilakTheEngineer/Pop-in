import {headers} from 'next/headers';
import {approvedOwnerSignupOrigin} from './owner-signup';

// Match the existing development-only signup gate. This only controls the form;
// the API remains the authority for every signup request.
export async function localSetupAvailable(){
 if(process.env.NODE_ENV!=='development'||process.env.POPIN_ENROLMENTS_PAUSED==='true')return false;
 const host=(await headers()).get('host')||'';
 try{return ['localhost','127.0.0.1','[::1]'].includes(new URL(`http://${host}`).hostname)}catch{return false}
}

export async function approvedSetupAvailable(){
 const origin=approvedOwnerSignupOrigin();return !!origin&&(await headers()).get('host')===new URL(origin).host;
}
