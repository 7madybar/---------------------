import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { ApiError, database, digest, now } from './server';
export const SESSION_COOKIE = '__Host-vg_team';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newAccessCode() {
  const random = crypto.getRandomValues(new Uint8Array(20));
  const value = Array.from(random, x => alphabet[x & 31]).join('');
  return 'VG-' + value.match(/.{5}/g)!.join('-');
}
export async function codeHash(code: string) {
  if (!env.TEAM_CODE_PEPPER || env.TEAM_CODE_PEPPER.length < 32) throw new ApiError(503, 'خدمة دخول الفريق غير مهيأة بعد.');
  const normalized = code.toUpperCase().replace(/[\s-]/g, '').replace(/^VG/, '');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TEAM_CODE_PEPPER), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('team-code:' + normalized)));
  return Array.from(hash, x => x.toString(16).padStart(2,'0')).join('');
}
async function bootstrapAdmin() {
  if (!env.INITIAL_ADMIN_CODE_HASH) return;
  if (!/^[a-f0-9]{64}$/.test(env.INITIAL_ADMIN_CODE_HASH) || !env.INITIAL_ADMIN_EMAIL) throw new ApiError(503,'إعداد رمز المدير غير مكتمل.');
  const db = database(), email = env.INITIAL_ADMIN_EMAIL.toLowerCase().trim();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO members (email,user_id,name,role,active,created_at) SELECT ?,?,'مدير الفريق','admin',1,? WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='code_admin_bootstrapped')").bind(email,crypto.randomUUID(),now()),
    db.prepare("UPDATE members SET access_code_hash=?, user_id=COALESCE(user_id,?) WHERE email=? AND NOT EXISTS (SELECT 1 FROM settings WHERE key='code_admin_bootstrapped')").bind(env.INITIAL_ADMIN_CODE_HASH,crypto.randomUUID(),email),
    db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('code_admin_bootstrapped','1')"),
  ]);
}
export async function signInWithCode(code: string) {
  const hash = await codeHash(code);
  await bootstrapAdmin();
  const db=database();
  const row=await db.prepare('SELECT email FROM members WHERE access_code_hash=? AND active=1').bind(hash).first<{email:string}>();
  if(!row)throw new ApiError(401,'الرمز غير صحيح أو تم إيقافه. راجعه وحاول مجدداً.');
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  await db.batch([
    db.prepare('DELETE FROM team_sessions WHERE expires_at<=?').bind(now()),
    db.prepare('INSERT INTO team_sessions (hash,member_email,created_at,expires_at) VALUES (?,?,?,?)').bind(await digest(token),row.email,now(),now()+28800),
  ]);
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`;
}
export async function signOutCode() {
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  if(token)await database().prepare('DELETE FROM team_sessions WHERE hash=?').bind(await digest(token)).run();
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
export async function issueCode(email:string) {
  const code=newAccessCode(), db=database();
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  const currentSession=token?await digest(token):'';
  const results=await db.batch([
    db.prepare('UPDATE members SET access_code_hash=?,user_id=COALESCE(user_id,?) WHERE email=?').bind(await codeHash(code),crypto.randomUUID(),email),
    db.prepare('DELETE FROM team_sessions WHERE member_email=? AND hash<>?').bind(email,currentSession),
  ]);
  if(!results[0].meta.changes)throw new ApiError(404,'العضو غير موجود.');
  return code;
}
