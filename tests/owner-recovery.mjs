import assert from 'node:assert/strict';
import { readdirSync,readFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const origin=process.argv[2]||'http://127.0.0.1:5173';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Local recovery tests only.');
function findDb(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const p=join(dir,item.name);if(item.isDirectory()){const found=findDb(p);if(found)return found;}else if(p.endsWith('.sqlite')&&item.name!=='metadata.sqlite')return p;}}
const db=new DatabaseSync(findDb(resolve('.wrangler/state/v3/d1')));db.exec('PRAGMA busy_timeout=5000');
const original=db.prepare("SELECT * FROM members WHERE email='seedy@sites.test'").get();
assert.equal(original.role,'owner');
const testCode='VG-RCVRA-RCVRB-RCVRC-RCVRD';
const config=readFileSync('.dev.vars','utf8');
const recoveryId=config.match(/^OWNER_RECOVERY_ID=(.+)$/m)?.[1].trim();
if(!recoveryId)throw Error('Configure local recovery test environment first.');
const marker='owner_recovery:'+recoveryId;
let memberId,checks=0;
async function request(path,status,{code,cookie='',method='GET',data}={}){
 const response=await fetch(origin+'/api/'+path,{method,headers:{...(method==='GET'?{}:{origin,'content-type':'application/json'}),...(cookie?{cookie}:{})},body:method==='GET'?undefined:JSON.stringify(code?{code}:data??{})});
 const result=await response.json();assert.equal(response.status,status,`${path}: ${JSON.stringify(result)}`);checks++;return {data:result,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const login=code=>request('team/login',200,{method:'POST',code});
try{
 db.exec("DELETE FROM rate_limits WHERE key LIKE 'team-login:%'");
 db.prepare('DELETE FROM settings WHERE key=?').run(marker);
 const first=await login('VG-TESTA-TESTB-TESTC-TESTD');
 const created=await request('members',201,{method:'POST',cookie:first.cookie,data:{name:'عضو اختبار استعادة المالك',role:'member'}});memberId=created.data.memberId;
 const other=await login(created.data.accessCode);
 const otherHash=db.prepare('SELECT access_code_hash FROM members WHERE user_id=?').get(memberId).access_code_hash;
 await request('team/login',401,{method:'POST',code:'VG-NOT-A-RECOVERY-CODE'});
 assert.equal(db.prepare("SELECT access_code_hash FROM members WHERE email=?").get(original.email).access_code_hash,original.access_code_hash);
 assert.equal(db.prepare('SELECT key FROM settings WHERE key=?').get(marker),undefined);
 const recovered=await login(testCode.toLowerCase());
 assert.equal((await request('me',200,{cookie:recovered.cookie})).data.member.role,'owner');
 assert.ok((await request('members',200,{cookie:recovered.cookie})).data.members.find(m=>m.self&&m.code_expires_at===null));
 await request('me',401,{cookie:first.cookie});
 await request('team/login',401,{method:'POST',code:'VG-TESTA-TESTB-TESTC-TESTD'});
 await request('me',200,{cookie:other.cookie});
 assert.equal(db.prepare('SELECT access_code_hash FROM members WHERE user_id=?').get(memberId).access_code_hash,otherHash);
 assert.ok(db.prepare('SELECT key FROM settings WHERE key=?').get(marker));
 const repeated=await login(testCode);
 await request('me',200,{cookie:recovered.cookie});
 await request('me',200,{cookie:repeated.cookie});
 // Consumed recovery must never undo later rotation, disabling, or expiry.
 await request('members/rotate',200,{method:'POST',cookie:recovered.cookie,data:{memberId:original.user_id}});
 const rotatedHash=db.prepare('SELECT access_code_hash FROM members WHERE email=?').get(original.email).access_code_hash;
 await request('team/login',401,{method:'POST',code:testCode});
 assert.equal(db.prepare('SELECT access_code_hash FROM members WHERE email=?').get(original.email).access_code_hash,rotatedHash);
 db.prepare('UPDATE members SET active=0 WHERE email=?').run(original.email);
 await request('team/login',401,{method:'POST',code:testCode});
 assert.equal(db.prepare('SELECT active FROM members WHERE email=?').get(original.email).active,0);
 console.log(`PASS: ${checks} owner recovery HTTP checks; one-use reset, owner role, permanent code, session revocation, replay protection and unchanged member access.`);
}finally{
 db.prepare('DELETE FROM team_sessions WHERE member_email=?').run(original.email);
 db.prepare('UPDATE members SET access_code_hash=?,active=?,access_code_expires_at=? WHERE email=?').run(original.access_code_hash,original.active,original.access_code_expires_at,original.email);
 if(memberId){const member=db.prepare('SELECT email FROM members WHERE user_id=?').get(memberId);if(member){db.prepare('DELETE FROM team_sessions WHERE member_email=?').run(member.email);db.prepare('DELETE FROM members WHERE user_id=?').run(memberId);}}
 db.prepare('DELETE FROM settings WHERE key=?').run(marker);
 db.exec("DELETE FROM rate_limits WHERE key LIKE 'team-login:%'");db.close();
}
