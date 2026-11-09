import { env } from 'cloudflare:workers';
import { ApiError,database } from './server';
import type { StatusEvent } from './constants';

// Domain-separated capability: never expose the salt or put this token in URLs/logs.
async function trackingKey(){
  if(!env.RATE_LIMIT_SALT)throw new ApiError(503,'خدمة المتابعة غير مهيأة حالياً.');
  return crypto.subtle.importKey('raw',new TextEncoder().encode(env.RATE_LIMIT_SALT),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
const trackingData=(id:string)=>new TextEncoder().encode('vg-submission-tracking:v1:'+id);
export async function trackingToken(id:string){
  const signature=new Uint8Array(await crypto.subtle.sign('HMAC',await trackingKey(),trackingData(id)));
  return id+'.'+btoa(String.fromCharCode(...signature)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export async function trackingId(token:unknown){
  if(typeof token!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/.test(token))throw new ApiError(400,'أدخل رمز المتابعة الكامل الذي ظهر بعد الإرسال.');
  const [id,encoded]=token.split('.');
  const signature=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
  const canonical=btoa(String.fromCharCode(...signature)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if(canonical!==encoded||!await crypto.subtle.verify('HMAC',await trackingKey(),signature,trackingData(id)))throw new ApiError(404,'لم نعثر على متابعة بهذا الرمز. تأكد من نسخه كاملاً؛ قد تكون الرسالة حُذفت.');
  return id;
}
export async function statusHistory(item:{id:string;status:string;created_at:number}):Promise<StatusEvent[]>{
  const events=await database().prepare('SELECT status,changed_by,changed_at FROM status_history WHERE submission_id=? ORDER BY id').bind(item.id).all<StatusEvent>();
  const history:StatusEvent[]=[{status:'new',changed_by:null,changed_at:item.created_at},...events.results];
  if(!events.results.length&&item.status!=='new')history.push({status:item.status as StatusEvent['status'],changed_by:null,changed_at:null});
  return history;
}
