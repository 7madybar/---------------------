import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { allowsPublicForm,preflight } from '../lib/public-cors.ts';
const origin=process.argv[2]||'http://127.0.0.1:5173';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Local development tests only.');
function findSqlite(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory()){const f=findSqlite(p);if(f)return f;}else if(p.endsWith('.sqlite'))return p;}}
const db=new DatabaseSync(findSqlite(resolve('.wrangler/state/v3/d1')));db.exec('PRAGMA busy_timeout=5000');
const ids=[],createdMembers=[];let checks=0,adminCookie='';
async function request(path,{method='GET',data,cookie='',headers={}}={}){const r=await fetch(origin+path,{method,headers:{...(method==='GET'?{}:{'Content-Type':'application/json',Origin:origin}),...(cookie?{Cookie:cookie}:{}),...headers},body:data===undefined?undefined:JSON.stringify(data)});let result;try{result=await r.json();}catch{result=null;}return {r,data:result};}
async function expect(path,status,options){const r=await request(path,options);assert.equal(r.r.status,status,`${path}: ${JSON.stringify(r.data)}`);checks++;return r;}
async function login(code,embedded=false){const r=await expect('/api/team/login',200,{method:'POST',data:{code,embedded}});const cookie=r.r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,embedded?/SameSite=None/:/SameSite=Lax/);if(embedded)assert.match(cookie,/Partitioned/);assert.match(cookie,/Max-Age=28800/);return cookie.split(';')[0];}
const payload=token=>({token,role:'visitor',category:'idea',message:'اختبار تكامل آلي 100% _ <script>alert(1)</script>',name:'',website:''});
async function token(){const {data}=await expect('/api/challenge',200,{method:'POST',data:{}});ids.push(data.token);db.prepare('UPDATE challenges SET created_at=created_at-3 WHERE id=?').run(data.token);return data.token;}
try{
 db.exec('DELETE FROM rate_limits');
 for(const path of ['/api/messages','/api/members','/api/me'])await expect(path,401);
 await expect('/api/me',401,{headers:{'oai-authenticated-user-id':'local_seedy','oai-authenticated-user-email':'seedy@sites.test'}});
 await expect('/api/me',401,{cookie:'__Host-vg_team=forged'});
 await expect('/api/team/login',401,{method:'POST',data:{code:'invalid'}});
 await expect('/api/team/login',403,{method:'POST',data:{code:'invalid'},headers:{Origin:'https://other.example'}});
 adminCookie=await login('VG-TESTA-TESTB-TESTC-TESTD');
 const admin={cookie:adminCookie};
 const {data:me}=await expect('/api/me',200,admin);assert.equal(me.member.role,'owner');assert.ok(!('access_code_hash' in me.member));
 const id=await token();
 for(const change of [{message:' '},{message:'x'.repeat(1201)},{role:'admin'},{category:'__proto__'},{website:'bot'}])await expect('/api/submit',400,{method:'POST',data:{...payload(id),...change}});
 await expect('/api/submit',413,{method:'POST',data:{...payload(id),junk:'x'.repeat(17000)}});
 const {data:saved}=await expect('/api/submit',201,{method:'POST',data:payload(id)});assert.deepEqual(saved,{receipt:id});
 await Promise.all(Array.from({length:4},()=>expect('/api/submit',200,{method:'POST',data:payload(id)})));
 assert.equal(db.prepare('SELECT count(*) n FROM submissions WHERE id=?').get(id).n,1);
 await expect('/api/submit',409,{method:'POST',data:{...payload(id),message:'changed'}});
 await expect('/api/messages/'+id,401);
 await expect('/api/messages/'+id+'/comments',401,{method:'POST',data:{id:crypto.randomUUID(),body:'forbidden'}});
 const {data:detail}=await expect('/api/messages/'+id,200,admin);assert.equal(detail.message.name,null);assert.equal(detail.message.message,payload(id).message);
 await expect('/api/messages/'+id,400,{...admin,method:'PATCH',data:{status:'bad'}});
 await expect('/api/messages/'+id,200,{...admin,method:'PATCH',data:{status:'reviewing'}});
 const commentId=crypto.randomUUID();for(let i=0;i<2;i++)await expect('/api/messages/'+id+'/comments',201,{...admin,method:'POST',data:{id:commentId,body:'تعليق داخلي تجريبي'}});
 const {data:thread}=await expect('/api/messages/'+id,200,admin);assert.equal(thread.comments.length,1);assert.equal(thread.message.status,'reviewing');
 const {data:list}=await expect('/api/messages?role=visitor&category=idea&status=reviewing&q=100%25%20_',200,admin);assert.ok(list.messages.some(m=>m.id===id));
 const {data:newMember}=await expect('/api/members',201,{...admin,method:'POST',data:{name:'عضو اختبار الرمز',role:'member'}});createdMembers.push(newMember.memberId);assert.ok(newMember.accessCode);
 let memberCookie=await login(newMember.accessCode);
 await expect('/api/messages/'+id,200,{cookie:memberCookie});
 const roster=await expect('/api/members',200,{cookie:memberCookie});
 assert.ok(roster.data.members.some(m=>m.role==='owner'));
 assert.ok(roster.data.members.every(m=>!('email' in m)&&!('access_code_hash' in m)&&!('user_id' in m)));
 await expect('/api/members',403,{method:'POST',cookie:memberCookie,data:{name:'forbidden',role:'admin'}});
 await expect('/api/members',403,{method:'PATCH',cookie:memberCookie,data:{memberId:me.member.user_id,role:'member',active:false}});
 await expect('/api/members/rotate',403,{method:'POST',cookie:memberCookie,data:{email:me.member.email}});
 const {data:rotated}=await expect('/api/members/rotate',200,{...admin,method:'POST',data:{email:newMember.memberId}});
 await expect('/api/me',401,{cookie:memberCookie});await expect('/api/team/login',401,{method:'POST',data:{code:newMember.accessCode}});
 memberCookie=await login(rotated.accessCode);
 await expect('/api/members',200,{...admin,method:'PATCH',data:{email:newMember.memberId,role:'member',active:false}});
 await expect('/api/me',401,{cookie:memberCookie});await expect('/api/team/login',401,{method:'POST',data:{code:rotated.accessCode}});
 await expect('/api/members',200,{...admin,method:'PATCH',data:{email:newMember.memberId,role:'member',active:true}});
 memberCookie=await login(rotated.accessCode);
 await expect('/api/team/logout',200,{cookie:memberCookie,method:'POST',data:{}});await expect('/api/me',401,{cookie:memberCookie});
 await expect('/api/members',400,{...admin,method:'PATCH',data:{email:me.member.email,role:'member',active:false}});
 const {data:team}=await expect('/api/members',200,admin);assert.ok(team.members.every(m=>!('access_code_hash' in m)));
 db.exec("DELETE FROM rate_limits WHERE key LIKE 'team-login:%'");
 const embeddedCookie=await login('VG-TESTA-TESTB-TESTC-TESTD',true);
 assert.equal((await expect('/api/me',200,{cookie:embeddedCookie})).data.member.role,'owner');
 assert.ok(db.prepare('SELECT expires_at-created_at AS span FROM team_sessions').all().every(s=>s.span===28800));
 await expect('/api/team/logout',200,{cookie:embeddedCookie,method:'POST',data:{embedded:true}});
 await expect('/api/me',401,{cookie:embeddedCookie});
 await expect('/api/team/login',403,{method:'POST',data:{code:'VG-TESTA-TESTB-TESTC-TESTD',embedded:true},headers:{Origin:'https://7madybar.github.io'}});
 const {data:manager}=await expect('/api/members',201,{...admin,method:'POST',data:{name:'مدير اختبار الصلاحيات',role:'admin'}});createdMembers.push(manager.memberId);
 const managerCookie=await login(manager.accessCode),managerAuth={cookie:managerCookie};
 assert.equal((await expect('/api/me',200,managerAuth)).data.member.role,'admin');
 const originalOwnerHash=db.prepare("SELECT access_code_hash FROM members WHERE email='seedy@sites.test'").get().access_code_hash;
 for(const ownerId of [me.member.user_id,me.member.email]){
   await expect('/api/members/rotate',403,{...managerAuth,method:'POST',data:{memberId:ownerId}});
   await expect('/api/members',403,{...managerAuth,method:'PATCH',data:{memberId:ownerId,role:'member',active:false}});
   await expect('/api/members',403,{...managerAuth,method:'PATCH',data:{memberId:ownerId,role:'admin',active:true}});
 }
 assert.equal(db.prepare("SELECT access_code_hash FROM members WHERE email='seedy@sites.test'").get().access_code_hash,originalOwnerHash);
 await expect('/api/members',400,{...managerAuth,method:'POST',data:{name:'cannot claim owner',role:'owner'}});
 await expect('/api/members',400,{...admin,method:'POST',data:{name:'cannot add owner',role:'owner'}});
 const {data:managed}=await expect('/api/members',201,{...managerAuth,method:'POST',data:{name:'عضو أضافه المدير',role:'member'}});createdMembers.push(managed.memberId);
 await expect('/api/members/rotate',200,{...managerAuth,method:'POST',data:{memberId:managed.memberId}});
 await expect('/api/members',200,{...managerAuth,method:'PATCH',data:{memberId:managed.memberId,role:'member',active:false}});
 await expect('/api/members',200,{...admin,method:'PATCH',data:{memberId:manager.memberId,role:'member',active:false}});
 await expect('/api/me',401,managerAuth);
 assert.equal((await expect('/api/me',200,admin)).data.member.role,'owner');
 db.prepare("UPDATE members SET active=0 WHERE email='seedy@sites.test'").run();await expect('/api/me',403,admin);assert.equal(db.prepare("SELECT active FROM members WHERE email='seedy@sites.test'").get().active,0);db.prepare("UPDATE members SET active=1 WHERE email='seedy@sites.test'").run();
 const expired=await token();db.prepare('UPDATE challenges SET expires_at=0 WHERE id=?').run(expired);await expect('/api/submit',410,{method:'POST',data:payload(expired)});
 const untilWindow=600-(Math.floor(Date.now()/1000)%600);
 if(untilWindow<5)await new Promise(resolve=>setTimeout(resolve,(untilWindow+0.1)*1000));
 db.exec("DELETE FROM rate_limits WHERE key LIKE 'submit:%'");
 const rates=await Promise.all(Array.from({length:6},()=>token()));for(let i=0;i<5;i++)await expect('/api/submit',201,{method:'POST',data:payload(rates[i])});await expect('/api/submit',429,{method:'POST',data:payload(rates[5])});
 const allowed='https://7madybar.github.io';const corsRequest=(path,origin=allowed,method='POST')=>new Request('https://server.test'+path,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':method,'Access-Control-Request-Headers':'content-type'}});
 assert.equal(preflight(corsRequest('/api/challenge'),allowed).status,204);assert.equal(preflight(corsRequest('/api/submit'),allowed).headers.get('Access-Control-Allow-Origin'),allowed);
 for(const path of ['/api/me','/api/members','/api/team/login','/api/messages']){assert.equal(preflight(corsRequest(path),allowed).status,403);assert.equal(allowsPublicForm(corsRequest(path),allowed),false);}
 assert.equal(preflight(corsRequest('/api/submit','https://attacker.example'),allowed).status,403);assert.equal(preflight(corsRequest('/api/submit',allowed,'GET'),allowed).status,403);
 let loginLimited=false;for(let attempt=0;attempt<12;attempt++){const r=await request('/api/team/login',{method:'POST',data:{code:'invalid'}});checks++;assert.ok([401,429].includes(r.r.status));if(r.r.status===429){loginLimited=true;break;}}assert.ok(loginLimited,'Login attempts must be rate limited.');
 console.log(`PASS: ${checks} HTTP checks + strict CORS assertions. Code login, session cookies, per-member access, rotation, revocation, logout, submission idempotency and private data protection.`);
}finally{
 db.prepare("UPDATE members SET role='owner',active=1 WHERE email='seedy@sites.test'").run();
 for(const id of ids){db.prepare('DELETE FROM comments WHERE submission_id=?').run(id);db.prepare('DELETE FROM submissions WHERE id=?').run(id);db.prepare('DELETE FROM challenges WHERE id=?').run(id);}
 for(const memberId of createdMembers){const row=db.prepare('SELECT email FROM members WHERE user_id=?').get(memberId);if(row){db.prepare('DELETE FROM team_sessions WHERE member_email=?').run(row.email);db.prepare('DELETE FROM members WHERE user_id=?').run(memberId);}}
 db.exec('DELETE FROM rate_limits');db.close();
}

