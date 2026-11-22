export async function register() {
 if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.POPIN_BOOKING_EMAIL_ENABLED==='true'){
  const {startEmailWorker}=await import('./lib/email-worker-node');
  startEmailWorker();
 }
 if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.WEBSMS_CUSTOMER_ENABLED==='true'){
  const {startSmsWorker}=await import('./lib/sms-worker-node');
  startSmsWorker();
 }
}
