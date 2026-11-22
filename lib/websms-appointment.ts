import {smsSegments} from './sms-segments';

// WebSMS's documented minimal appointment template, including its mandatory
// suffix. Refuse messages over two parts; never shorten a shop name or time.
export function prepareWebSmsAppointment(shop:string,startsAt:Date){
 if(!shop.trim()||!Number.isFinite(startsAt.getTime()))throw new Error('A shop name and appointment time are required.');
 const smsShop=shop.replace(/([aeiouAEIOU])\u0304/g,'$1').replace(/[āēīōūĀĒĪŌŪ]/g,char=>({'ā':'a','ē':'e','ī':'i','ō':'o','ū':'u','Ā':'A','Ē':'E','Ī':'I','Ō':'O','Ū':'U'}[char]!));
 const date=new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',day:'2-digit',month:'2-digit'}).format(startsAt);
 const time=new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',hour:'numeric',minute:'2-digit',hour12:true}).format(startsAt).replace(/\s/g,'').toLowerCase();
 const text=`Your next appointment with ${smsShop} is on ${date} at ${time}. Std SMS charges apply.`;
 const count=smsSegments(text);
 return {shop:smsShop,date,time,text,...count,sendable:count.segments<=2};
}
