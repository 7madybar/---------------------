'use client';
import { useRef,useState } from 'react';
import { Code2,Clapperboard,Network,Users,ArrowUpLeft,Check,LoaderCircle,CheckCircle2,AlertCircle,LockKeyhole,Lightbulb,ClipboardList,Zap,MessageSquare,Ellipsis } from 'lucide-react';
import { ROLES,CATEGORIES } from '@/lib/constants';
import { publicApi } from '@/lib/public-site';
import SubmissionTracking,{TrackingCode} from './submission-tracking';
const roleIcons={tech:Code2,media:Clapperboard,organization:Network,visitor:Users};
const roleDescriptions={tech:'حلول تصنع الفرق',media:'صوت الفريق وصورته',organization:'التفاصيل تصنع النجاح',visitor:'رأيك يضيف لنا'};
const failureMessage=(e:unknown)=>e instanceof Error && !(e instanceof TypeError) && e.name!=='AbortError' && e.name!=='TimeoutError'?e.message:'تعذر الاتصال. بقيت رسالتك في النموذج؛ أعد المحاولة.';
const categoryIcons={idea:Lightbulb,report:ClipboardList,urgent:Zap,note:MessageSquare,other:Ellipsis};
export default function FeedbackForm(){
 const [view,setView]=useState('submit'),[tracking,setTracking]=useState('');
 const [role,setRole]=useState(''),[category,setCategory]=useState(''),[message,setMessage]=useState(''),[name,setName]=useState(''),[website,setWebsite]=useState('');
 const [pending,setPending]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[errors,setErrors]=useState<Record<string,string>>({});
 const lock=useRef(false),errorBox=useRef<HTMLDivElement>(null),form=useRef<HTMLFormElement>(null);
 const challengeRequest=useRef<Promise<{token:string;readyAt:number}>|null>(null);
 function challenge(){
  if(!challengeRequest.current){
   challengeRequest.current=(async()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),20000);
    try{
     const response=await fetch(publicApi('challenge'),{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:'{}',signal:controller.signal});
     const data=await response.json() as {token?:string;error?:string};
     if(!response.ok||!data.token)throw new Error(data.error||'تعذر بدء التحقق. أعد المحاولة.');
     return {token:data.token,readyAt:Date.now()+2100};
    }finally{clearTimeout(timeout);}
   })().catch(error=>{challengeRequest.current=null;throw error;});
  }
  return challengeRequest.current;
 }
 function clearField(key:string){setErrors(old=>({...old,[key]:''}));}
 async function submit(event:React.FormEvent){event.preventDefault();if(lock.current)return;
   const invalid:Record<string,string>={};if(!role)invalid.role='اختر صفتك للمتابعة.';if(!category)invalid.category='اختر نوع الرسالة.';if(!message.trim())invalid.message='اكتب رسالتك أولاً.';
   setErrors(invalid);if(Object.keys(invalid).length){setTimeout(()=>form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),0);return;}
   lock.current=true;setPending(true);setError('');
   try{const {token:currentToken,readyAt}=await challenge();const remaining=readyAt-Date.now();if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
     const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
     let response;try{response=await fetch(publicApi('submit'),{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({role,category,message,name,website,token:currentToken})});}finally{clearTimeout(timer);}
     const result=await response.json() as { receipt?:string; trackingToken?:string; error?:string };if(!response.ok){if(response.status===410)challengeRequest.current=null;throw new Error(result.error||'تعذر إرسال الرسالة.');}
     if(!result.receipt||!result.trackingToken)throw new Error('لم يصل تأكيد الحفظ ورمز المتابعة. يرجى إعادة المحاولة.');setSuccess(result.receipt);setTracking(result.trackingToken);setMessage('');setName('');
   }catch(e){setError(failureMessage(e));setTimeout(()=>errorBox.current?.focus(),0);}finally{lock.current=false;setPending(false);}
 }
 const navigation=<nav className="public-mode-switch" aria-label="إرسال الرسائل ومتابعتها"><button className={view==='submit'?'active':''} disabled={pending} onClick={()=>setView('submit')}>إرسال رسالة</button><button className={view==='track'?'active':''} disabled={pending} onClick={()=>setView('track')}>متابعة رسالة</button></nav>;
 if(view==='track')return <>{navigation}<SubmissionTracking initialToken={tracking}/></>;
 if(success)return <>{navigation}<section className="success-panel" aria-live="polite"><span className="success-icon"><CheckCircle2 size={38}/></span><span className="eyebrow" dir="ltr">MESSAGE RECEIVED</span><h2>وصلت رسالتك. شكراً لمشاركتك.</h2><p>حُفظت رسالتك بنجاح، وأصبحت متاحة للفريق للاطلاع والمتابعة.</p><div className="receipt">رقم الرسالة <b dir="ltr">{success.slice(0,8).toUpperCase()}</b></div><TrackingCode token={tracking}/><div className="success-actions"><button className="primary" onClick={()=>setView('track')}>متابعة حالة الرسالة <ArrowUpLeft size={19}/></button><button className="secondary" onClick={()=>{setSuccess('');setRole('');setCategory('');challengeRequest.current=null;}}>إرسال رسالة أخرى</button></div></section></>;
 return <>{navigation}<form ref={form} onSubmit={submit} noValidate className="feedback-form" aria-busy={pending}>
 <div className="form-topline"><span><span className="live-dot"/> قناة التواصل المباشر</span><span dir="ltr">VG+ / FEEDBACK</span></div>
 <fieldset disabled={pending}><legend><span className="step">01</span>من أين تشاركنا؟ <span className="required">*</span></legend><p className="field-hint">اختر الصفة الأقرب إليك.</p>
 <div className="role-grid" role="radiogroup" aria-label="صفتك" aria-required="true" aria-invalid={!!errors.role} aria-describedby={errors.role?'role-error':undefined} tabIndex={errors.role?-1:undefined}>
 {Object.entries(ROLES).map(([value,label])=>{const Icon=roleIcons[value as keyof typeof roleIcons];return <label className={'role-card '+(role===value?'selected':'')} key={value}><input type="radio" name="role" value={value} checked={role===value} onChange={()=>{setRole(value);clearField('role');void challenge().catch(()=>{});}}/><span className="role-card-top"><Icon size={23}/><span className="radio-mark">{role===value&&<Check size={10}/>}</span></span><strong>{label}</strong><span className="role-description">{roleDescriptions[value as keyof typeof roleDescriptions]}</span></label>;})}</div>{errors.role&&<p id="role-error" className="field-error">{errors.role}</p>}</fieldset>
 <fieldset disabled={pending}><legend><span className="step">02</span>ما نوع رسالتك؟ <span className="required">*</span></legend><div className="category-grid" role="radiogroup" aria-label="نوع الرسالة" aria-required="true" aria-invalid={!!errors.category} tabIndex={errors.category?-1:undefined}>
 {Object.entries(CATEGORIES).map(([value,label])=>{const Icon=categoryIcons[value as keyof typeof categoryIcons];return <label key={value} className={'category '+(category===value?'selected':'')}><input type="radio" name="category" value={value} checked={category===value} onChange={()=>{setCategory(value);clearField('category');}}/><Icon size={15}/>{label}</label>;})}</div>{errors.category&&<p className="field-error">{errors.category}</p>}</fieldset>
 <div className="message-field"><label htmlFor="message" className="field-label"><span className="step">03</span>مساحة لرسالتك <span className="required">*</span></label><div className={'textarea-wrap '+(errors.message?'invalid':'')}><textarea id="message" value={message} onChange={e=>{setMessage(e.target.value);clearField('message');}} maxLength={1200} required disabled={pending} placeholder="فكرة تستحق المشاركة، اقتراح يصنع فرقاً، أو ملاحظة تساعدنا على التطوّر…" aria-invalid={!!errors.message} aria-describedby="message-hint message-error"/><div className="textarea-bottom"><span id="message-hint">كل فكرة تبدأ بكلمة.</span><span className={message.length>1100?'counter near-limit':'counter'} dir="ltr">{message.length.toLocaleString('en')} <span>/ 1,200</span></span></div></div><p id="message-error" className="field-error">{errors.message}</p></div>
 <div className="name-field"><label htmlFor="name">الاسم <span className="optional">اختياري</span></label><input id="name" type="text" maxLength={80} value={name} onChange={e=>setName(e.target.value)} disabled={pending} placeholder="بماذا تحب أن نناديك؟" autoComplete="name"/><p className="field-hint">يمكنك ترك هذا الحقل فارغاً.</p></div>
 <div className="honeypot" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></div>
 {error&&<div ref={errorBox} role="alert" className="error-box" tabIndex={-1}><AlertCircle size={18}/><span>{error}</span></div>}
 <div className="submit-row"><p><LockKeyhole size={15}/> يطّلع على رسالتك أعضاء الفريق المخوّلون فقط.</p><button className="primary" type="submit" disabled={pending}>{pending?<><LoaderCircle className="spin" size={19}/>جارٍ الإرسال…</>:<>إرسال الرسالة <ArrowUpLeft size={19}/></>}</button></div>
 </form></>;
}



