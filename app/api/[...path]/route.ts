import { ApiError, database, member, body, checkOrigin, textField, json, now, limit, identity, digest } from '@/lib/server';
import { ROLES,CATEGORIES,STATUSES } from '@/lib/constants';
import { signInWithCode,signOutCode,newAccessCode,codeHash,issueCode } from '@/lib/team-codes';
import { managesTeam,managesMember } from '@/lib/team-access';
import type { Member } from '@/lib/constants';
import { sessionPolicy } from '@/lib/session-settings';
import { validSessionHours } from '@/lib/session-policy';
import { validCodeHours } from '@/lib/code-validity';
import { trackingToken,trackingId,statusHistory } from '@/lib/submission-tracking';
function codeExpiry(value:unknown){if(!validCodeHours(value))throw new ApiError(400,'حدد صلاحية الرمز من 1 إلى 8760 ساعة، أو اختر رمزاً دائماً.');return value===null?null:now()+value*3600;}
export const dynamic='force-dynamic';
const summaryQuery = "SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN status='new' THEN 1 ELSE 0 END),0) AS 'new',COALESCE(SUM(CASE WHEN status='reviewing' THEN 1 ELSE 0 END),0) AS reviewing,COALESCE(SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END),0) AS resolved FROM submissions";
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
    if(existing){
      await limit('submit-retry:'+ip,10);
      const original=await db.prepare('SELECT id FROM challenges WHERE id=? AND ip_hash=?').bind(token,ip).first();
      if(!original)throw new ApiError(410,'تعذر تأكيد إعادة الطلب من هذا الاتصال. إذا سبق وصول تأكيد الإرسال، استخدم رمز المتابعة المحفوظ.');
      if(existing.fingerprint!==fingerprint)throw new ApiError(409,'تم استخدام هذا الطلب مسبقاً. حدّث الصفحة لإرسال رسالة جديدة.');
      return json({receipt:token,trackingToken:await trackingToken(token)});
    }
    const challenge=await db.prepare('SELECT * FROM challenges WHERE id=? AND ip_hash=?').bind(token,ip).first<{created_at:number;expires_at:number}>();
    if(!challenge||challenge.expires_at<now())throw new ApiError(410,'انتهت صلاحية التحقق. أعد المحاولة، رسالتك محفوظة في النموذج.');
    if(now()-challenge.created_at<2)throw new ApiError(400,'يرجى الانتظار لحظة ثم إعادة الإرسال.');
    await limit('submit:'+ip,5);
    await db.prepare("INSERT OR IGNORE INTO submissions (id,role,category,message,name,status,created_at,fingerprint) SELECT ?,?,?,?,?,'new',?,? WHERE EXISTS (SELECT 1 FROM challenges WHERE id=? AND ip_hash=? AND expires_at>=?)").bind(token,role,category,message,name||null,now(),fingerprint,token,ip,now()).run();
    const saved=await db.prepare('SELECT fingerprint FROM submissions WHERE id=?').bind(token).first<{fingerprint:string}>();
    if(!saved)throw new ApiError(410,'انتهت صلاحية التحقق. أعد المحاولة، رسالتك محفوظة في النموذج.');
    if(saved.fingerprint!==fingerprint)throw new ApiError(409,'تعارض في الطلب. حدّث الصفحة وحاول مجدداً.');
    return json({receipt:token,trackingToken:await trackingToken(token)},201);
  }
  if(path[0]==='track'&&path.length===1&&method==='POST'){
    await limit('track:'+await identity(request),30);
    const data=await body(request),id=await trackingId(data.token);
    const item=await db.prepare('SELECT id,status,created_at FROM submissions WHERE id=?').bind(id).first<{id:string;status:string;created_at:number}>();
    if(!item)throw new ApiError(404,'لم نعثر على متابعة بهذا الرمز. تأكد من نسخه كاملاً؛ قد تكون الرسالة حُذفت.');
    return json({status:item.status,created_at:item.created_at,history:await statusHistory(item)});
  }
  const me=await member();
  if(path.join('/')==='team/session-settings'){
    if(me.role!=='owner')throw new ApiError(403,'إعداد مدة الجلسة متاح للمالك فقط.');
    if(method==='GET')return json(await sessionPolicy());
    if(method==='PATCH'){
      const data=await body(request);
      if(!Object.hasOwn(data,'hours')||!validSessionHours(data.hours))throw new ApiError(400,'حدد مدة من 1 إلى 8760 ساعة، أو اختر بدون انتهاء تلقائي.');
      await db.prepare("INSERT INTO settings (key,value) VALUES ('team_session_hours',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(data.hours)).run();
      return json({hours:data.hours});
    }
  }
  if(path[0]==='me'&&path.length===1&&method==='GET')return json({member:me});
  if(path.join('/')==='messages/summary'&&method==='GET'){
    const summary=await db.prepare(summaryQuery).first();
    return json(summary);
  }
  if(path[0]==='messages'&&path.length===1&&method==='GET'){
    const conditions:string[]=[],args:(string|number)[]=[];
    for(const [key,values] of [['role',ROLES],['category',CATEGORIES],['status',STATUSES]] as const){const v=url.searchParams.get(key);if(v){if(!Object.hasOwn(values,v))throw new ApiError(400,'فلتر غير صالح.');conditions.push(key+'=?');args.push(v);}}
    const search=(url.searchParams.get('q')||'').slice(0,120);if(search){conditions.push("(message LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\')");const escaped=search.replace(/[\\%_]/g,'\\$&');args.push('%'+escaped+'%','%'+escaped+'%');}
    const rawPage=Number(url.searchParams.get('page')||1);const page=Number.isFinite(rawPage)?Math.max(1,Math.floor(rawPage)):1;
    const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
    const includeSummary = url.searchParams.get('summary') === '1';
    const needsCount = !includeSummary || conditions.length > 0;
    const statements = [db.prepare('SELECT id,role,category,message,name,status,created_at FROM submissions'+where+' ORDER BY created_at DESC,id LIMIT 25 OFFSET ?').bind(...args,(page-1)*25)];
    if(needsCount) statements.push(db.prepare('SELECT COUNT(*) AS total FROM submissions'+where).bind(...args));
    if(includeSummary) statements.push(db.prepare(summaryQuery));
    const [messages,countOrSummary,filteredSummary] = await db.batch(statements);
    const summary = includeSummary ? (filteredSummary ?? countOrSummary).results[0] : undefined;
    const count = countOrSummary.results[0] as {total:number} | undefined;
    return json({messages:messages.results,total:count?.total??0,page,summary});
  }
  if(path[0]==='messages'&&path[1]){
    if(method==='DELETE'&&path.length===2&&me.role!=='owner')throw new ApiError(403,'حذف الرسائل متاح للمالك فقط.');
    const id=path[1]; const item=await db.prepare('SELECT id,role,category,message,name,status,created_at FROM submissions WHERE id=?').bind(id).first();
    if(!item)throw new ApiError(404,'الرسالة غير موجودة.');
    if(path.length===2&&method==='DELETE'){
      const result=await db.batch([
        db.prepare('DELETE FROM comments WHERE submission_id=?').bind(id),
        db.prepare('DELETE FROM challenges WHERE id=?').bind(id),
        db.prepare('DELETE FROM status_history WHERE submission_id=?').bind(id),
        db.prepare('DELETE FROM submissions WHERE id=?').bind(id),
      ]);
      if(!result[3].meta.changes)throw new ApiError(404,'الرسالة غير موجودة.');
      return json({ok:true});
    }
    if(path.length===2&&method==='GET'){const comments=await db.prepare('SELECT id,author_name,body,created_at FROM comments WHERE submission_id=? ORDER BY created_at,id').bind(id).all();return json({message:item,comments:comments.results,history:await statusHistory(item as {id:string;status:string;created_at:number})});}
    if(path.length===2&&method==='PATCH'){
      await limit('status:'+me.user_id,60);
      const data=await body(request);if(!Object.hasOwn(STATUSES,data.status))throw new ApiError(400,'حالة غير صالحة.');
      const result=await db.batch([
        db.prepare('INSERT INTO status_history (submission_id,status,changed_by,changed_at) SELECT id,?,?,? FROM submissions WHERE id=? AND status<>?').bind(data.status,me.name,now(),id,data.status),
        db.prepare('UPDATE submissions SET status=? WHERE id=?').bind(data.status,id),
      ]);
      if(!result[1].meta.changes)throw new ApiError(404,'الرسالة غير موجودة.');return json({ok:true});
    }
    if(path[2]==='comments'&&path.length===3&&method==='POST'){await limit('comment:'+me.user_id,60);const data=await body(request);const comment=textField(data.body,2000,1),commentId=textField(data.id,36,36);await db.prepare('INSERT OR IGNORE INTO comments (id,submission_id,author_id,author_name,body,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM submissions WHERE id=?)').bind(commentId,id,me.user_id,me.name,comment,now(),id).run();const saved=await db.prepare('SELECT id FROM comments WHERE id=? AND submission_id=?').bind(commentId,id).first();if(!saved)throw new ApiError(404,'الرسالة غير موجودة.');return json({ok:true},201);}
  }
  if(path[0]==='members'){
    if(method==='GET'&&path.length===1){
      const result=await db.prepare('SELECT user_id AS id,name,role,active,created_at,access_code_expires_at AS code_expires_at FROM members ORDER BY created_at').all();
      return json({members:result.results.map(row=>({...row,self:row.id===me.user_id}))});
    }
    if(method==='DELETE'&&path.length===1){
      if(me.role!=='owner')throw new ApiError(403,'حذف أعضاء الفريق متاح للمالك فقط.');
      const data=await body(request),id=textField(data.memberId,254,1);
      const target=await db.prepare('SELECT email,user_id,role FROM members WHERE user_id=?').bind(id).first<Pick<Member,'email'|'user_id'|'role'>>();
      if(!target)throw new ApiError(404,'العضو غير موجود.');
      if(target.role==='owner'||target.email===me.email)throw new ApiError(403,'لا يمكن حذف حساب المالك.');
      const result=await db.batch([
        db.prepare("DELETE FROM team_sessions WHERE member_email=? AND EXISTS (SELECT 1 FROM members WHERE email=? AND role<>'owner' AND email<>?)").bind(target.email,target.email,me.email),
        db.prepare("DELETE FROM members WHERE email=? AND role<>'owner' AND email<>?").bind(target.email,me.email),
      ]);
      if(!result[1].meta.changes)throw new ApiError(404,'العضو غير موجود.');
      return json({ok:true});
    }
    if(!managesTeam(me.role))throw new ApiError(403,'يمكنك مشاهدة الفريق؛ إدارة الأعضاء والرموز متاحة للمالك والمدير فقط.');
    if(method==='POST'&&path.length===1){
      const data=await body(request),name=textField(data.name,80,1);
      if(!['admin','member'].includes(data.role))throw new ApiError(400,'اختر مديراً أو عضواً. صلاحية المالك محمية.');
      const expiresAt=codeExpiry(Object.hasOwn(data,'codeHours')?data.codeHours:null);
      const email='member_'+crypto.randomUUID(),userId=crypto.randomUUID(),code=newAccessCode();
      await db.prepare('INSERT INTO members (email,user_id,name,role,active,created_at,access_code_hash,access_code_expires_at) VALUES (?,?,?,?,1,?,?,?)').bind(email,userId,name,data.role,now(),await codeHash(code),expiresAt).run();
      return json({ok:true,accessCode:code,memberId:userId,codeExpiresAt:expiresAt},201);
    }
    if((method==='POST'&&path[1]==='rotate'&&path.length===2)||(method==='PATCH'&&path.length===1)||(method==='PATCH'&&path[1]==='code-expiry'&&path.length===2)){
      const data=await body(request),id=textField(data.memberId??data.email,254,1);
      const target=await db.prepare('SELECT email,user_id,name,role,active,created_at FROM members WHERE user_id=? OR email=?').bind(id,id).first<Member>();
      if(!target)throw new ApiError(404,'العضو غير موجود.');
      if(!managesMember(me,target))throw new ApiError(403,'حساب المالك محمي؛ لا يمكن للمدير تغيير صلاحيته أو إيقافه أو تجديد رمزه.');
      if(method==='POST'){const expiresAt=codeExpiry(Object.hasOwn(data,'codeHours')?data.codeHours:null);return json({ok:true,accessCode:await issueCode(target.email,expiresAt),codeExpiresAt:expiresAt});}
      if(path[1]==='code-expiry'){
        const expiresAt=codeExpiry(data.codeHours);
        await db.prepare('UPDATE members SET access_code_expires_at=? WHERE user_id=?').bind(expiresAt,target.user_id).run();
        return json({ok:true,codeExpiresAt:expiresAt});
      }
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
export const GET=handle;export const POST=handle;export const PATCH=handle;export const DELETE=handle;
