import {BookingError} from './booking';

export type TransactionalEmail = {to:string;subject:string;text:string;idempotencyKey:string};

// This adapter is server-side only. Never log requests: messages may contain private links.
export async function sendTransactionalEmail(message:TransactionalEmail, transport:typeof fetch=fetch) {
 const apiKey=process.env.RESEND_API_KEY?.trim(),from=process.env.POPIN_EMAIL_FROM?.trim();
 if(!apiKey||!from)throw new BookingError('Email delivery is not configured. Contact Varello support.');
 if(!message.to||!message.subject||!message.text||!message.idempotencyKey)throw new BookingError('Email details are incomplete.');
 let response:Response;
 try {
  response=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':message.idempotencyKey},body:JSON.stringify({from,to:[message.to],subject:message.subject,text:message.text}),signal:AbortSignal.timeout(10000)});
 } catch {throw new BookingError('Email delivery could not be confirmed. Please try again later.');}
 if(!response.ok)throw new BookingError('Email delivery could not be confirmed. Please try again later.');
 const result=await response.json().catch(()=>null);
 if(!result||typeof result.id!=='string'||!result.id)throw new BookingError('Email delivery could not be confirmed. Please try again later.');
 return {providerId:result.id as string};
}
