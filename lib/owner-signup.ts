import {verificationOrigin} from './owner-email-verification';

// Registration approval is deliberately separate from approving a shop to go live.
// An empty list or missing delivery configuration keeps remote signup closed.
export function approvedOwnerSignupOrigin(){
 if(process.env.POPIN_OWNER_SIGNUP_ENABLED!=='true'||process.env.POPIN_ENROLMENTS_PAUSED==='true'||!process.env.RESEND_API_KEY?.trim()||!process.env.POPIN_EMAIL_FROM?.trim()||!approvedEmails().length)return null;
 const origin=verificationOrigin();return origin&&new URL(origin).protocol==='https:'?origin:null;
}
function approvedEmails(){return (process.env.POPIN_OWNER_SIGNUP_ALLOWED_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(value=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))}
export function approvedOwnerSignup(request:Request,email:unknown){
 const origin=approvedOwnerSignupOrigin();return !!origin&&request.headers.get('origin')===origin&&typeof email==='string'&&approvedEmails().includes(email.trim().toLowerCase());
}
