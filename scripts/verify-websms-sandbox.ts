import {inspectWebSmsSandbox} from '../lib/beta-message-test';
import {appointmentReminder,smsSegments} from '../lib/sms-segments';

// Sandbox requests only: the adapter refuses production and non-local databases.
// Provide the token through the environment, never as a command-line argument.
const token=process.env.WEBSMS_SANDBOX_TOKEN?.trim();
if(!token)throw new Error('Set WEBSMS_SANDBOX_TOKEN to a WebSMS test access token.');
const startsAt='2026-12-15T01:30:00Z';
for(const shopName of ['Rimu','Te Whānau o Ngā Kaimahi Hair and Beauty Rotorua']){
 const text=appointmentReminder(shopName,startsAt);
 const provider=await inspectWebSmsSandbox(token,{channel:'sms',to:'64215550100',template:'appointment',shopName,startsAt,text});
 console.log(JSON.stringify({shopName,varello:{text,...smsSegments(text)},provider}));
}
