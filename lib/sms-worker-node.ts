import {dispatchSmsReminder,enqueueDueSmsReminders} from './sms-reminder-outbox';

export function startSmsWorker(){
 let running=false;
 const poll=async()=>{if(running)return;running=true;try{await enqueueDueSmsReminders();for(let i=0;i<20;i++){const result=await dispatchSmsReminder();if(result.status==='none'||result.status==='disabled'||result.status==='quiet_hours')break}}catch{console.error('SMS reminder worker could not process the queue.')}finally{running=false}};
 void poll();setInterval(()=>void poll(),30000).unref();
}
