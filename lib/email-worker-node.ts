import {dispatchBookingEmail,resendBookingEmailProvider} from './booking-email-outbox';
import {enqueueDueEmailReminders} from './reminders';

// Database leases and unique event keys protect concurrent instances.
export function startEmailWorker(){
 let running=false;
 const poll=async()=>{
  if(running)return;
  running=true;
  try{
   const provider=resendBookingEmailProvider();
   await enqueueDueEmailReminders();
   for(let i=0;i<20;i++){
    const result=await dispatchBookingEmail(provider);
    if(result.status==='none')break;
   }
  }catch{console.error('Booking email worker could not process the outbox.');}
  finally{running=false;}
 };
 void poll();
 setInterval(()=>void poll(),30000).unref();
}
