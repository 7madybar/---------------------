import { env } from 'cloudflare:workers';
import { database, digest, now } from './server';

// Disabled by default. A verified hosting owner must configure all three values.
// The proof is a SHA-256 digest of a fresh 100-bit code, never the code itself.
export async function recoverOwnerIfAuthorized(normalizedCode:string,accessCodeHash:string){
  const id=env.OWNER_RECOVERY_ID,proof=env.OWNER_RECOVERY_PROOF;
  const email=env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const deadline=Number(env.OWNER_RECOVERY_EXPIRES_AT),time=now();
  if(!id||!proof||!email||!/^[a-f0-9-]{36}$/.test(id)||!/^[a-f0-9]{64}$/.test(proof))return;
  if(!Number.isSafeInteger(deadline)||deadline<=time||deadline>time+3600)return;
  if(await digest('owner-recovery:'+normalizedCode)!==proof)return;
  const db=database(),key='owner_recovery:'+id;
  await db.batch([
    db.prepare("UPDATE members SET access_code_hash=?,access_code_expires_at=NULL,active=1 WHERE email=? AND role='owner' AND NOT EXISTS (SELECT 1 FROM settings WHERE key=?)").bind(accessCodeHash,email,key),
    db.prepare("DELETE FROM team_sessions WHERE member_email=? AND NOT EXISTS (SELECT 1 FROM settings WHERE key=?) AND EXISTS (SELECT 1 FROM members WHERE email=? AND role='owner' AND access_code_hash=?)").bind(email,key,email,accessCodeHash),
    db.prepare("INSERT OR IGNORE INTO settings (key,value) SELECT ?,? WHERE EXISTS (SELECT 1 FROM members WHERE email=? AND role='owner' AND access_code_hash=? AND active=1 AND access_code_expires_at IS NULL)").bind(key,String(time),email,accessCodeHash),
  ]);
}
