'use client';
import { useRef,useState } from 'react';
import { KeyRound,ArrowUpLeft,LoaderCircle } from 'lucide-react';
import { canonicalHomeUrl,isEmbedded } from '@/lib/public-site';
import { sessionDurationText } from '@/lib/session-policy';
export default function CodeLogin({initialError='',sessionHours}:{initialError?:string;sessionHours:number|null}){
 const [code,setCode]=useState(''),[error,setError]=useState(initialError),[busy,setBusy]=useState(false),[sessionBlocked,setSessionBlocked]=useState(false);const lock=useRef(false);
 async function submit(e:React.FormEvent){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setSessionBlocked(false);try{
  const r=await fetch('/api/team/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,embedded:isEmbedded()})});
  const data=await r.json() as {error?:string};if(!r.ok)throw new Error(data.error||'تعذر الدخول.');const check=await fetch('/api/me',{cache:'no-store'});if(!check.ok){setSessionBlocked(true);throw new Error('المتصفح لم يسمح بحفظ جلسة الفريق داخل الصفحة. جرّب متصفحاً محدثاً أو افتح اللوحة المستقلة.');}window.location.assign(isEmbedded()?'/admin?embedded=1':'/admin');
 }catch(e){setError(e instanceof TypeError?'تعذر الاتصال بالخادم. أعد المحاولة.':e instanceof Error?e.message:'تعذر الدخول.');setBusy(false);lock.current=false;}}
 return <main className="auth-panel"><KeyRound size={36}/><span className="eyebrow">مساحة الفريق الخاصة</span><h1>أهلاً بفريق VG+</h1><p>أدخل رمزك الخاص للوصول إلى الرسائل ونقاش الفريق.</p><form className="code-login" onSubmit={submit}><label htmlFor="access-code">رمز الدخول</label><input id="access-code" type="password" dir="ltr" autoComplete="current-password" required maxLength={80} value={code} onChange={e=>setCode(e.target.value)} placeholder="VG-XXXXX-XXXXX-XXXXX-XXXXX" disabled={busy}/>{error&&<div role="alert" className="error-box">{error}</div>}<button className="primary" disabled={busy}>{busy?<><LoaderCircle className="spin" size={18}/>جارٍ التحقق…</>:<>دخول الفريق <ArrowUpLeft size={18}/></>}</button></form><small>لكل عضو رمز مستقل. مدة الجلسة: {sessionDurationText(sessionHours)}. صلاحية الرمز يحددها المالك أو المدير بشكل منفصل.{sessionHours===null&&' قد يطلب المتصفح الرمز مجدداً إذا حذف بيانات الموقع.'}</small>{sessionBlocked&&<a className="secondary" href="/admin" target="_top">فتح اللوحة المستقلة</a>}<a className="team-link" href={canonicalHomeUrl} target="_top">العودة لصندوق التواصل</a></main>;
}

