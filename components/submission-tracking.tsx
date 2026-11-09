'use client';
import { useRef,useState } from 'react';
import { Search,LoaderCircle,Copy,Check } from 'lucide-react';
import { STATUSES,type TrackingResult } from '@/lib/constants';
import { publicApi } from '@/lib/public-site';
import StatusTimeline from './status-timeline';

export function TrackingCode({token}:{token:string}){
 const [copied,setCopied]=useState(false),[failed,setFailed]=useState(false);
 return <div className="tracking-code"><label htmlFor="receipt-code">رمز المتابعة الخاص بك</label><textarea id="receipt-code" readOnly dir="ltr" value={token} rows={3} onFocus={e=>e.currentTarget.select()}/><button type="button" className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(token);setCopied(true);setFailed(false);}catch{setFailed(true);}}}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'نُسخ الرمز':'نسخ رمز المتابعة'}</button><p role="status">{failed?'تعذر النسخ التلقائي؛ اضغط على الرمز وحدده ثم انسخه.':'احتفظ بالرمز للمتابعة من أي جهاز. من يملكه يستطيع رؤية الحالة واسم محدّدها وتوقيتها فقط؛ لا تشاركه علناً.'}</p></div>;
}
export default function SubmissionTracking({initialToken=''}:{initialToken?:string}){
 const [token,setToken]=useState(initialToken),[result,setResult]=useState<TrackingResult|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
 const lock=useRef(false),resultBox=useRef<HTMLDivElement>(null);
 async function track(e:React.FormEvent){e.preventDefault();if(lock.current)return;const value=token.trim();if(!value){setError('أدخل رمز المتابعة أولاً.');return;}lock.current=true;setPending(true);setError('');setResult(null);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{const r=await fetch(publicApi('track'),{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({token:value})});const data=await r.json() as TrackingResult&{error?:string};if(!r.ok)throw new Error(data.error||'تعذرت متابعة الرسالة.');if(!data.history||!Object.hasOwn(STATUSES,data.status))throw new Error('لم تصل حالة مؤكدة من الخادم.');setResult(data);setTimeout(()=>resultBox.current?.focus(),0);}catch(e){setError(e instanceof Error&&!(e instanceof TypeError)&&e.name!=='AbortError'?e.message:'تعذر الاتصال بالخادم؛ رمزك محفوظ هنا. أعد المحاولة.');}finally{clearTimeout(timer);lock.current=false;setPending(false);}
 }
 return <section className="tracking-panel" aria-labelledby="tracking-title"><div className="eyebrow"><Search size={16}/> متابعة خاصة</div><h2 id="tracking-title">وين وصلت رسالتك؟</h2><p>أدخل الرمز الكامل الذي ظهر بعد الإرسال لمعرفة الحالة ومن حدّدها ومتى.</p><form onSubmit={track} aria-busy={pending}><label htmlFor="tracking-token">رمز المتابعة</label><textarea id="tracking-token" dir="ltr" rows={3} maxLength={100} value={token} autoComplete="off" spellCheck={false} disabled={pending} onChange={e=>{setToken(e.target.value);setResult(null);setError('');}} aria-invalid={!!error} aria-describedby="tracking-help"/><p id="tracking-help" className="field-hint">الرقم المختصر للرسائل القديمة لا يكفي. المتابعة متاحة بالرمز الكامل الصادر بعد هذا التحديث.</p>{error&&<div className="error-box" role="alert">{error}</div>}<button className="primary" disabled={pending}>{pending?<><LoaderCircle className="spin" size={18}/>جارٍ التحقق…</>:<>عرض حالة الرسالة<Search size={18}/></>}</button></form>{result&&<div ref={resultBox} tabIndex={-1} className="tracking-result" aria-live="polite"><h3>الحالة الحالية: <span className={'badge status-'+result.status}>{STATUSES[result.status]}</span></h3><StatusTimeline history={result.history}/><p className="field-hint">تحديث الحالة يعني تغييرها داخل لوحة الفريق. التعليقات ومحتوى الرسالة لا يظهران هنا. أوقات العرض حسب جهازك؛ اضغط «عرض حالة الرسالة» لتحديث النتيجة.</p></div>}</section>;
}
