import { ApiError, database, member, body, checkOrigin, textField, json, now, limit, identity, digest } from '@/lib/server';
import { ROLES,CATEGORIES,STATUSES } from '@/lib/constants';
import { signInWithCode,signOutCode,newAccessCode,codeHash,issueCode } from '@/lib/team-codes';
import { managesTeam,managesMember } from '@/lib/team-access';
import type { Member } from '@/lib/constants';
export const dynamic='force-dynamic';
async function handle(request:Request){try{
  const url=new URL(request.url), path=url.pathname.replace(/^\/api\//,'').split('/'), method=request.method;
  if(method!=='GET')checkOrigin(request);
  const db=database();
  if(path.join('/')==='team/login'&&method==='POST'){
    await limit('team-login:'+await identity(request),10);
    const data=await body(request),code=textField(data.code,80,1);
    const cookie=await signInWithCode(code,data.embedded===true);const response=json({ok:true});response.headers.set('Set-Cookie',cookie);return response;
  }
  if(path.join('/')==='team/logout'&&method==='POST'){
    const data=await body(request);const response=json({ok:true});response.headers.set('Set-Cookie',await signOutCode(data.embedded===true));return response;
  }
  if(path[0]==='challenge' && path.length===1 && method==='POST'){
    const ip=await identity(request);await limit('challenge:'+ip,30);
    const id=crypto.randomUUID(),time=now();
    await db.batch([db.prepare('DELETE FROM challenges WHERE expires_at<?').bind(time-86400),db.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(time),db.prepare('INSERT INTO challenges (id,ip_hash,created_at,expires_at) VALUES (?,?,?,?)').bind(id,ip,time,time+1800)]);
    return json({token:id});
  }
  if(path[0]==='submit'&&path.length===1&&method==='POST'){
    const data=await body(request), ip=await identity(request);
    if(typeof data.website!=='string'||data.website!=='')throw new ApiError(400,'تعذر التحقق من الطلب.');
    const role=textField(data.role,30,1),category=textField(data.category,30,1),message=textField(data.message,1200,1),name=textField(data.name??'',80),token=textField(data.token,36,36);
    if(!Object.hasOwn(ROLES,role)||!Object.hasOwn(CATEGORIES,category))throw new ApiError(400,'اختر الصفة ونوع الرسالة.');
    const fingerprint=await digest(JSON.stringify({role,category,message,name}));
    const existing=await db.prepare('SELECT fingerprint FROM submissions WHERE id=?').bind(token).first<{fingerprint:string}>();
    if(existing){if(existing.fingerprint!==fingerprint)throw new ApiError(409,'تم استخدام هذا الطلب مسبقاً. حدّث الصفحة لإرسال رسالة جديدة.');return json({receipt:token});}
    const challenge=await db.prepare('SELECT * FROM challenges WHERE id=? AND ip_hash=?').bind(token,ip).first<{created_at:number;expires_at:number}>();
    if(!challenge||challenge.expires_at<now())throw new ApiError(410,'انتهت صلاحية التحقق. أعد المحاولة، رسالتك محفوظة في النموذج.');
    if(now()-challenge.created_at<2)throw new ApiError(400,'يرجى الانتظار لحظة ثم إعادة الإرسال.');
    await limit('submit:'+ip,5);
    await db.prepare("INSERT OR IGNORE INTO submissions (id,role,category,message,name,status,created_at,fingerprint) VALUES (?,?,?,?,?,'new',?,?)").bind(token,role,category,message,name||null,now(),fingerprint).run();
    const saved=await db.prepare('SELECT fingerprint FROM submissions WHERE id=?').bind(token).first<{fingerprint:string}>();
    if(!saved||saved.fingerprint!==fingerprint)throw new ApiError(409,'تعارض في الطلب. حدّث الصفحة وحاول مجدداً.');
    return json({receipt:token},201);
  }
  const me=await member();
  if(path[0]==='me'&&path.length===1&&method==='GET')return json({member:me});
  if(path[0]==='messages'&&path.length===1&&method==='GET'){
    const conditions:string[]=[],args:(string|number)[]=[];
    for(const [key,values] of [['role',ROLES],['category',CATEGORIES],['status',STATUSES]] as const){const v=url.searchParams.get(key);if(v){if(!Object.hasOwn(values,v))throw new ApiError(400,'فلتر غير صالح.');conditions.push(key+'=?');args.push(v);}}
    const search=(url.searchParams.get('q')||'').slice(0,120);if(search){conditions.push("(message LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\')");const escaped=search.replace(/[\\%_]/g,'\\$&');args.push('%'+escaped+'%','%'+escaped+'%');}
    const rawPage=Number(url.searchParams.get('page')||1);const page=Number.isFinite(rawPage)?Math.max(1,Math.floor(rawPage)):1;
    const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
    const count=await db.prepare('SELECT COUNT(*) AS total FROM submissions'+where).bind(...args).first();
    const result=await db.prepare('SELECT id,role,category,message,name,status,created_at FROM submissions'+where+' ORDER BY created_at DESC,id LIMIT 25 OFFSET ?').bind(...args,(page-1)*25).all();
    return json({messages:result.results,total:count?.total??0,page});
  }
  if(path[0]==='messages'&&path[1]){
    const id=path[1]; const item=await db.prepare('SELECT id,role,category,message,name,status,created_at FROM submissions WHERE id=?').bind(id).first();
    if(!item)throw new ApiError(404,'الرسالة غير موجودة.');
    if(path.length===2&&method==='GET'){const comments=await db.prepare('SELECT id,author_name,body,created_at FROM comments WHERE submission_id=? ORDER BY created_at,id').bind(id).all();return json({message:item,comments:comments.results});}
    if(path.length===2&&method==='PATCH'){const data=await body(request);if(!Object.hasOwn(STATUSES,data.status))throw new ApiError(400,'حالة غير صالحة.');await db.prepare('UPDATE submissions SET status=? WHERE id=?').bind(data.status,id).run();return json({ok:true});}
    if(path[2]==='comments'&&path.length===3&&method==='POST'){await limit('comment:'+me.user_id,60);const data=await body(request);const comment=textField(data.body,2000,1),commentId=textField(data.id,36,36);await db.prepare('INSERT OR IGNORE INTO comments (id,submission_id,author_id,author_name,body,created_at) VALUES (?,?,?,?,?,?)').bind(commentId,id,me.user_id,me.name,comment,now()).run();return json({ok:true},201);}
  }
  if(path[0]==='members'){
    if(method==='GET'&&path.length===1){
      const result=await db.prepare('SELECT user_id AS id,name,role,active,created_at FROM members ORDER BY created_at').all();
      return json({members:result.results.map(row=>({...row,self:row.id===me.user_id}))});
    }
    if(!managesTeam(me.role))throw new ApiError(403,'يمكنك مشاهدة الفريق؛ إدارة الأعضاء والرموز متاحة للمالك والمدير فقط.');
    if(method==='POST'&&path.length===1){
      const data=await body(request),name=textField(data.name,80,1);
      if(!['admin','member'].includes(data.role))throw new ApiError(400,'اختر مديراً أو عضواً. صلاحية المالك محمية.');
      const email='member_'+crypto.randomUUID(),userId=crypto.randomUUID(),code=newAccessCode();
      await db.prepare('INSERT INTO members (email,user_id,name,role,active,created_at,access_code_hash) VALUES (?,?,?,?,1,?,?)').bind(email,userId,name,data.role,now(),await codeHash(code)).run();
      return json({ok:true,accessCode:code,memberId:userId},201);
    }
    if((method==='POST'&&path[1]==='rotate'&&path.length===2)||(method==='PATCH'&&path.length===1)){
      const data=await body(request),id=textField(data.memberId??data.email,254,1);
      const target=await db.prepare('SELECT email,user_id,name,role,active,created_at FROM members WHERE user_id=? OR email=?').bind(id,id).first<Member>();
      if(!target)throw new ApiError(404,'العضو غير موجود.');
      if(!managesMember(me,target))throw new ApiError(403,'حساب المالك محمي؛ لا يمكن للمدير تغيير صلاحيته أو إيقافه أو تجديد رمزه.');
      if(method==='POST')return json({ok:true,accessCode:await issueCode(target.email)});
      if(target.role==='owner'||target.user_id===me.user_id)throw new ApiError(400,'لا يمكنك إيقاف حسابك أو تغيير صلاحية المالك.');
      if(!['admin','member'].includes(data.role)||typeof data.active!=='boolean')throw new ApiError(400,'بيانات الصلاحية غير صالحة.');
      await db.batch([
        db.prepare("UPDATE members SET role=?,active=? WHERE user_id=? AND role<>'owner'").bind(data.role,data.active?1:0,target.user_id),
        db.prepare('DELETE FROM team_sessions WHERE member_email=? AND ?=0').bind(target.email,data.active?1:0),
      ]);
      return json({ok:true});
    }
  }
  throw new ApiError(404,'المسار غير موجود.');
}catch(error){if(error instanceof ApiError)return json({error:error.message},error.status);console.error('Request failed',error instanceof Error?error.name:'Unknown');return json({error:'تعذر إتمام الطلب حالياً. يرجى المحاولة لاحقاً.'},503);}}
export const GET=handle;export const POST=handle;export const PATCH=handle;
