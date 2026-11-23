import './local-qa-guard.mjs';
import assert from 'node:assert/strict';
import {approvedOwnerSignup,approvedOwnerSignupOrigin} from '../lib/owner-signup';
const origin='https://signup.example.test';
process.env.POPIN_PUBLIC_ORIGIN=origin;process.env.RESEND_API_KEY='fictional';process.env.POPIN_EMAIL_FROM='test@example.test';process.env.POPIN_OWNER_SIGNUP_ALLOWED_EMAILS='approved@example.test';
const request=new Request(origin+'/api/onboarding',{headers:{origin}});
delete process.env.POPIN_OWNER_SIGNUP_ENABLED;assert.equal(approvedOwnerSignupOrigin(),null);
process.env.POPIN_OWNER_SIGNUP_ENABLED='true';assert.equal(approvedOwnerSignupOrigin(),origin);assert.equal(approvedOwnerSignup(request,' APPROVED@example.test '),true);assert.equal(approvedOwnerSignup(request,'unapproved@example.test'),false);assert.equal(approvedOwnerSignup(new Request(origin,{headers:{origin:'https://other.example.test'}}),'approved@example.test'),false);
for(const name of ['RESEND_API_KEY','POPIN_EMAIL_FROM','POPIN_OWNER_SIGNUP_ALLOWED_EMAILS']){const prior=process.env[name];delete process.env[name];assert.equal(approvedOwnerSignupOrigin(),null);process.env[name]=prior}
process.env.POPIN_ENROLMENTS_PAUSED='true';assert.equal(approvedOwnerSignupOrigin(),null);delete process.env.POPIN_ENROLMENTS_PAUSED;
for(const invalid of ['http://127.0.0.1:3003','https://user:password@signup.example.test','https://signup.example.test/path','https://signup.example.test/?query=1']){process.env.POPIN_PUBLIC_ORIGIN=invalid;assert.equal(approvedOwnerSignupOrigin(),null)}
console.log('PASS: registration default-off, explicit approved email, exact origin, delivery prerequisites, HTTPS and pause override. No provider used.');
