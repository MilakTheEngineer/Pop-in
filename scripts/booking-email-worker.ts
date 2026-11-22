import {db} from '../lib/db';
import {dispatchBookingEmail,resendBookingEmailProvider} from '../lib/booking-email-outbox';

// This worker is not started by the application. It refuses to run unless the
// explicit delivery flag and provider configuration are supplied by an operator.
try{
 const provider=resendBookingEmailProvider();
 const once=process.argv.includes('--once');
 do{const result=await dispatchBookingEmail(provider);if(once)break;if(result.status==='none'||result.status==='retry')await new Promise(resolve=>setTimeout(resolve,30000))}while(true);
}finally{await db.end()}
