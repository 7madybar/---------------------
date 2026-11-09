import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { ApiError, database, digest, now } from './server';
import { SESSION_COOKIE,EMBED_SESSION_COOKIE,PERSISTENT_COOKIE_SECONDS,sessionCookie } from './session-cookie';
import { sessionPolicy } from './session-settings';
import { recoverOwnerIfAuthorized } from './owner-recovery';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normalizeCode=(code:string)=>code.toUpperCase().replace(/[\s-]/g,'').replace(/^VG/,'');
export function newAccessCode() {
  const random = crypto.getRandomValues(new Uint8Array(20));
  const value = Array.from(random, x => alphabet[x & 31]).join('');
  return 'VG-' + value.match(/.{5}/g)!.join('-');
}
export async function codeHash(code: string) {
  if (!env.TEAM_CODE_PEPPER || env.TEAM_CODE_PEPPER.length < 32) throw new ApiError(503, 'خدمة دخول الفريق غير مهيأة بعد.');
  const normalized = normalizeCode(code);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TEAM_CODE_PEPPER), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('team-code:' + normalized)));
  return Array.from(hash, x => x.toString(16).padStart(2,'0')).join('');
}
async function bootstrapAdmin() {
  if (!env.INITIAL_ADMIN_CODE_HASH) return;
  if (!/^[a-f0-9]{64}$/.test(env.INITIAL_ADMIN_CODE_HASH) || !env.INITIAL_ADMIN_EMAIL) throw new ApiError(503,'إعداد رمز المدير غير مكتمل.');
  const db = database(), email = env.INITIAL_ADMIN_EMAIL.toLowerCase().trim();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO members (email,user_id,name,role,active,created_at) SELECT ?,?,'مالك الموقع','owner',1,? WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='code_admin_bootstrapped')").bind(email,crypto.randomUUID(),now()),
    db.prepare("UPDATE members SET access_code_hash=?, user_id=COALESCE(user_id,?) WHERE email=? AND NOT EXISTS (SELECT 1 FROM settings WHERE key='code_admin_bootstrapped')").bind(env.INITIAL_ADMIN_CODE_HASH,crypto.randomUUID(),email),
    db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('code_admin_bootstrapped','1')"),
  ]);
}
export async function signInWithCode(code: string, embedded=false) {
  const hash = await codeHash(code);
  await bootstrapAdmin();
  await recoverOwnerIfAuthorized(normalizeCode(code),hash);
  const db=database();
  const row=await db.prepare('SELECT email,access_code_expires_at FROM members WHERE access_code_hash=? AND active=1 AND (access_code_expires_at IS NULL OR access_code_expires_at>?)').bind(hash,now()).first<{email:string;access_code_expires_at:number|null}>();
  if(!row)throw new ApiError(401,'الرمز غير صحيح أو انتهت صلاحيته أو تم إيقافه. تواصل مع مدير الفريق.');
  const {hours}=await sessionPolicy(),time=now();
  const sessionExpiresAt=hours===null?null:time+hours*60*60;
  const expiresAt=sessionExpiresAt===null?row.access_code_expires_at:row.access_code_expires_at===null?sessionExpiresAt:Math.min(sessionExpiresAt,row.access_code_expires_at);
  if(expiresAt!==null&&expiresAt<=time)throw new ApiError(401,'انتهت صلاحية الرمز. تواصل مع مدير الفريق.');
  const seconds=expiresAt===null?PERSISTENT_COOKIE_SECONDS:expiresAt-time;
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  await db.batch([
    db.prepare('DELETE FROM team_sessions WHERE expires_at<>0 AND expires_at<=?').bind(time),
    db.prepare('INSERT INTO team_sessions (hash,member_email,created_at,expires_at) VALUES (?,?,?,?)').bind(await digest(token),row.email,time,expiresAt??0),
  ]);
  return sessionCookie(token,embedded,seconds);
}
export async function signOutCode(embedded=false) {
  const jar=await cookies();
  for(const name of [SESSION_COOKIE,EMBED_SESSION_COOKIE]){
    const token=jar.get(name)?.value;
    if(token)await database().prepare('DELETE FROM team_sessions WHERE hash=?').bind(await digest(token)).run();
  }
  return sessionCookie('',embedded,0);
}
export async function issueCode(email:string,expiresAt:number|null=null) {
  const code=newAccessCode(), db=database();
  const jar=await cookies();
  const token=jar.get(EMBED_SESSION_COOKIE)?.value || jar.get(SESSION_COOKIE)?.value;
  const currentSession=token?await digest(token):'';
  const results=await db.batch([
    db.prepare('UPDATE members SET access_code_hash=?,access_code_expires_at=?,user_id=COALESCE(user_id,?) WHERE email=?').bind(await codeHash(code),expiresAt,crypto.randomUUID(),email),
    db.prepare('DELETE FROM team_sessions WHERE member_email=? AND hash<>?').bind(email,currentSession),
  ]);
  if(!results[0].meta.changes)throw new ApiError(404,'العضو غير موجود.');
  return code;
}
