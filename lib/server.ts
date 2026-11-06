import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import type { Member } from './constants';
import { allowsPublicForm } from './public-cors';
export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export function database(){ if(!env.DB) throw new ApiError(503,'قاعدة البيانات غير مهيأة. يرجى المحاولة لاحقاً.'); return env.DB; }
export const now = ()=>Math.floor(Date.now()/1000);
export async function digest(value:string){ return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join(''); }
export async function identity(request:Request){
  if(!env.RATE_LIMIT_SALT) throw new ApiError(503,'خدمة الإرسال غير مهيأة بعد. يرجى المحاولة لاحقاً.');
  return digest(env.RATE_LIMIT_SALT + ':' + (request.headers.get('cf-connecting-ip') || 'local'));
}
export async function limit(key:string,max:number,seconds=600){
  const db=database(), time=now(), bucket=Math.floor(time/seconds);
  const row=await db.prepare('INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key+':'+bucket,time+seconds*2).first<{count:number}>();
  if(!row || row.count>max) throw new ApiError(429,'محاولات كثيرة. يرجى الانتظار عشر دقائق ثم المحاولة.');
}
export function checkOrigin(request:Request){
  const origin=request.headers.get('origin');
  if(!origin || (origin!==new URL(request.url).origin && !(request.method==='POST' && allowsPublicForm(request,env.PUBLIC_FORM_ORIGIN)))) throw new ApiError(403,'تعذر التحقق من مصدر الطلب. حدّث الصفحة وحاول مجدداً.');
  if(!request.headers.get('content-type')?.includes('application/json')) throw new ApiError(415,'صيغة الطلب غير مدعومة.');
}
export async function body(request:Request){
  const reader=request.body?.getReader(); if(!reader) throw new ApiError(400,'الطلب فارغ.');
  const chunks:Uint8Array[]=[]; let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();throw new ApiError(413,'حجم الطلب أكبر من المسموح.');}chunks.push(value);}
  const joined=new Uint8Array(size);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
  try{const data=JSON.parse(new TextDecoder().decode(joined));if(!data || Array.isArray(data)||typeof data!=='object')throw Error();return data;}catch{throw new ApiError(400,'بيانات الطلب غير صالحة.');}
}
export function textField(value:unknown,max:number,min=0){if(typeof value!=='string'||value.length>max||value.trim().length<min)throw new ApiError(400,`يرجى مراجعة الحقول المطلوبة وحدود النص (${max} حرفاً).`);return value.trim();}
export async function member():Promise<Member>{
  const token=(await cookies()).get('__Host-vg_team')?.value;
  if(!token || !/^[A-Za-z0-9_-]{43}$/.test(token))throw new ApiError(401,'أدخل رمز الفريق للمتابعة.');
  const row=await database().prepare('SELECT m.email,m.user_id,m.name,m.role,m.active,m.created_at FROM team_sessions s JOIN members m ON m.email=s.member_email WHERE s.hash=? AND s.expires_at>?').bind(await digest(token),now()).first<Member>();
  if(!row)throw new ApiError(401,'انتهت جلسة الدخول. أدخل رمزك مجدداً.');
  if(!row.active)throw new ApiError(403,'تم إيقاف وصول هذا العضو. تواصل مع مدير الفريق.');
  return row;
}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});}

