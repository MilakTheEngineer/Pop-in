// No messaging provider is connected. Remote preview is explicitly enabled
// only for the fictional Rimu shop, on the configured HTTPS demo origin.
export function localConfirmationPreview(request:Request){try{const origin=new URL(request.headers.get('origin')||'');return process.env.NODE_ENV==='development'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname)}catch{return false}}
export function hostedDemoEnabled(){return process.env.POPIN_ENVIRONMENT==='staging'&&process.env.POPIN_REMOTE_PREVIEW==='true'}
export function hostedOwnerSetupPreview(request:Request){
 if(!hostedDemoEnabled())return false;
 try{const configured=new URL(process.env.POPIN_PUBLIC_ORIGIN||''),origin=request.headers.get('origin');return configured.protocol==='https:'&&configured.origin===origin}catch{return false}
}
export function hostedDemoPreview(request:Request,shopId:string){
 if(!hostedDemoEnabled()||shopId!=='rimu')return false;
 try{const configured=new URL(process.env.POPIN_PUBLIC_ORIGIN||''),origin=request.headers.get('origin');return configured.protocol==='https:'&&origin===configured.origin}catch{return false}
}
export function confirmationPreview(request:Request,shopId:string){return localConfirmationPreview(request)||hostedDemoPreview(request,shopId)}
export function demoEmailAllowed(request:Request,shopId:string,email:unknown){return !hostedDemoPreview(request,shopId)||(typeof email==='string'&&/^[^\s@]+@example\.test$/i.test(email.trim()))}
