'use client';
import { useRef,useState } from 'react';
import { KeyRound,ArrowUpLeft,LoaderCircle } from 'lucide-react';
export default function CodeLogin({initialError=''}:{initialError?:string}){
 const [code,setCode]=useState(''),[error,setError]=useState(initialError),[busy,setBusy]=useState(false);const lock=useRef(false);
 async function submit(e:React.FormEvent){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  const r=await fetch('/api/team/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
  const data=await r.json() as {error?:string};if(!r.ok)throw new Error(data.error||'تعذر الدخول.');window.location.assign('/admin');
 }catch(e){setError(e instanceof TypeError?'تعذر الاتصال بالخادم. أعد المحاولة.':e instanceof Error?e.message:'تعذر الدخول.');setBusy(false);lock.current=false;}}
 return <main className="auth-panel"><KeyRound size={36}/><span className="eyebrow">مساحة الفريق الخاصة</span><h1>أهلاً بفريق VG+</h1><p>أدخل رمزك الخاص للوصول إلى الرسائل ونقاش الفريق.</p><form className="code-login" onSubmit={submit}><label htmlFor="access-code">رمز الدخول</label><input id="access-code" type="password" dir="ltr" autoComplete="current-password" required maxLength={80} value={code} onChange={e=>setCode(e.target.value)} placeholder="VG-XXXXX-XXXXX-XXXXX-XXXXX" disabled={busy}/>{error&&<div role="alert" className="error-box">{error}</div>}<button className="primary" disabled={busy}>{busy?<><LoaderCircle className="spin" size={18}/>جارٍ التحقق…</>:<>دخول الفريق <ArrowUpLeft size={18}/></>}</button></form><small>لكل عضو رمز مستقل يصدره مدير الفريق. تنتهي الجلسة بعد 8 ساعات.</small><a className="team-link" href="/">العودة لصندوق التواصل</a></main>;
}
