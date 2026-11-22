// Run the durable outbox inside the existing Node service; database leases keep
// concurrent instances from claiming the same message.
export async function register() {
 if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.POPIN_BOOKING_EMAIL_ENABLED !== 'true') return;
 const {dispatchBookingEmail,resendBookingEmailProvider}=await import('./lib/booking-email-outbox');
 let running=false;
 const poll=async()=>{
  if(running)return;
  running=true;
  try {
   const provider=resendBookingEmailProvider();
   for(let i=0;i<20;i++){
    const result=await dispatchBookingEmail(provider);
    if(result.status==='none'||result.status==='retry')break;
   }
  } catch {console.error('Booking email worker could not process the outbox.');}
  finally {running=false;}
 };
 void poll();
 setInterval(()=>void poll(),30000).unref();
}
