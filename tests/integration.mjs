import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const origin=process.argv[2]||'http://localhost:5173';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Tests are restricted to a local development database.');
function findSqlite(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory()){const found=findSqlite(p);if(found)return found;}else if(p.endsWith('.sqlite'))return p;}}
const file=findSqlite(resolve('.wrangler/state/v3/d1'));assert.ok(file,'Apply local migrations first.');
const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=5000');
const ids=[],createdMembers=[];let checks=0;
async function request(path,{method='GET',data,cookie=false,headers={}}={}){const r=await fetch(origin+path,{method,headers:{...(method==='GET'?{}:{'Content-Type':'application/json',Origin:origin}),...(cookie?{Cookie:'__sites_local_auth=1'}:{}),...headers},body:data===undefined?undefined:JSON.stringify(data)});let result;try{result=await r.json();}catch{result=null;}return {r,data:result};}
async function expect(path,status,options){const result=await request(path,options);assert.equal(result.r.status,status,`${path}: ${JSON.stringify(result.data)}`);checks++;return result;}
const payload=token=>({token,role:'visitor',category:'idea',message:'اختبار تكامل آلي 100% _ <script>alert(1)</script>',name:'',website:''});
async function token(){const {data}=await expect('/api/challenge',200,{method:'POST',data:{}});ids.push(data.token);db.prepare('UPDATE challenges SET created_at=created_at-3 WHERE id=?').run(data.token);return data.token;}
try{
 db.exec('DELETE FROM rate_limits');
 await expect('/api/messages',401);
 await expect('/api/members',401);
 await expect('/api/me',401,{headers:{'oai-authenticated-user-id':'local_seedy','oai-authenticated-user-email':'seedy@sites.test'}});
 await expect('/api/challenge',403,{method:'POST',data:{},headers:{Origin:'https://other.example'}});
 await expect('/api/challenge',415,{method:'POST',data:{},headers:{'Content-Type':'text/plain'}});
 const id=await token();
 await expect('/api/submit',400,{method:'POST',data:{...payload(id),message:' '.repeat(10)}});
 await expect('/api/submit',400,{method:'POST',data:{...payload(id),message:'x'.repeat(1201)}});
 await expect('/api/submit',400,{method:'POST',data:{...payload(id),role:'admin'}});
 await expect('/api/submit',400,{method:'POST',data:{...payload(id),category:'__proto__'}});
 await expect('/api/submit',400,{method:'POST',data:{...payload(id),website:'bot'}});
 await expect('/api/submit',413,{method:'POST',data:{...payload(id),junk:'x'.repeat(17000)}});
 const {data:saved}=await expect('/api/submit',201,{method:'POST',data:payload(id)});assert.equal(saved.receipt,id);assert.deepEqual(Object.keys(saved),['receipt']);
 await expect('/api/submit',200,{method:'POST',data:payload(id)});
 await Promise.all(Array.from({length:4},()=>expect('/api/submit',200,{method:'POST',data:payload(id)})));
 assert.equal(db.prepare('SELECT count(*) n FROM submissions WHERE id=?').get(id).n,1);
 await expect('/api/submit',409,{method:'POST',data:{...payload(id),message:'changed'}});
 await expect('/api/messages/'+id,401);
 await expect('/api/messages/'+id+'/comments',401,{method:'POST',data:{id:crypto.randomUUID(),body:'forbidden'}});
 const {data:me}=await expect('/api/me',200,{cookie:true});assert.equal(me.member.role,'admin');
 const {data:detail}=await expect('/api/messages/'+id,200,{cookie:true});assert.equal(detail.message.name,null);assert.equal(detail.message.message,payload(id).message);
 await expect('/api/messages/'+id,400,{method:'PATCH',cookie:true,data:{status:'bad'}});
 await expect('/api/messages/'+id,200,{method:'PATCH',cookie:true,data:{status:'reviewing'}});
 const commentId=crypto.randomUUID();await expect('/api/messages/'+id+'/comments',201,{method:'POST',cookie:true,data:{id:commentId,body:'تعليق داخلي تجريبي'}});
 await expect('/api/messages/'+id+'/comments',201,{method:'POST',cookie:true,data:{id:commentId,body:'تعليق داخلي تجريبي'}});
 const {data:thread}=await expect('/api/messages/'+id,200,{cookie:true});assert.equal(thread.comments.length,1);assert.equal(thread.message.status,'reviewing');
 const {data:list}=await expect('/api/messages?role=visitor&category=idea&status=reviewing&q=100%25%20_',200,{cookie:true});assert.ok(list.messages.some(m=>m.id===id));
 await expect('/api/messages?status=invalid',400,{cookie:true});
 const email='qa-'+crypto.randomUUID()+'@example.com';createdMembers.push(email);
 await expect('/api/members',201,{method:'POST',cookie:true,data:{email,name:'عضو اختبار',role:'member'}});
 await expect('/api/members',409,{method:'POST',cookie:true,data:{email,name:'عضو اختبار',role:'member'}});
 await expect('/api/members',200,{method:'PATCH',cookie:true,data:{email,role:'admin',active:false}});
 await expect('/api/members',400,{method:'PATCH',cookie:true,data:{email:'seedy@sites.test',role:'member',active:false}});
 db.prepare("UPDATE members SET role='member' WHERE email='seedy@sites.test'").run();
 await expect('/api/messages/'+id,200,{cookie:true});await expect('/api/members',403,{cookie:true});
 db.prepare("UPDATE members SET active=0 WHERE email='seedy@sites.test'").run();
 await expect('/api/messages/'+id,403,{cookie:true});await expect('/api/me',403,{cookie:true});
 assert.equal(db.prepare("SELECT active FROM members WHERE email='seedy@sites.test'").get().active,0,'Bootstrap must not undo revoked membership.');
 db.prepare("UPDATE members SET role='admin',active=1 WHERE email='seedy@sites.test'").run();
 const expired=await token();db.prepare('UPDATE challenges SET expires_at=0 WHERE id=?').run(expired);await expect('/api/submit',410,{method:'POST',data:payload(expired)});
 const rates=await Promise.all(Array.from({length:5},()=>token()));
 for(let i=0;i<4;i++)await expect('/api/submit',201,{method:'POST',data:payload(rates[i])});
 await expect('/api/submit',429,{method:'POST',data:payload(rates[4])});
 console.log(`PASS: ${checks} HTTP checks; persistent records, idempotency, search, roles, revocation, internal comments, CSRF, validation, spam and rate limits.`);
}finally{
 db.prepare("UPDATE members SET role='admin',active=1 WHERE email='seedy@sites.test'").run();
 for(const id of ids){db.prepare('DELETE FROM comments WHERE submission_id=?').run(id);db.prepare('DELETE FROM submissions WHERE id=?').run(id);db.prepare('DELETE FROM challenges WHERE id=?').run(id);}
 for(const email of createdMembers)db.prepare('DELETE FROM members WHERE email=?').run(email);
 db.exec('DELETE FROM rate_limits');db.close();
}
