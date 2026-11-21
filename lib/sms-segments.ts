// Count the encoded message, not JavaScript characters: GSM extension characters
// consume two septets and macrons switch the whole message to UTF-16.
const basic = new Set(Array.from("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"));
const extended = new Set(Array.from("^{}\\[~]|€\f"));
export function smsSegments(text:string){
 let units=0;let gsm=true;
 for(const char of text){if(basic.has(char))units++;else if(extended.has(char))units+=2;else{gsm=false;break}}
 if(!gsm)units=text.length;
 return {encoding:gsm?'GSM-7' as const:'UCS-2' as const,units,segments:units===0?0:Math.ceil(units/(units<=(gsm?160:70)?(gsm?160:70):(gsm?153:67)))};
}
export function appointmentReminder(shopName:string,startsAt:string){
 const when=new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(startsAt));
 return `${shopName}: Reminder, your appointment is ${when}.`;
}
