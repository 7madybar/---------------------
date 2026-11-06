import { Header,Footer } from '@/components/chrome';
import Dashboard from '@/components/dashboard';
import { getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath } from '@/app/chatgpt-auth';
import { member,ApiError } from '@/lib/server';
import { ShieldCheck,ArrowUpLeft,ShieldX } from 'lucide-react';
export const dynamic='force-dynamic';
export default async function Admin(){
 const user=await getChatGPTUser();
 if(!user)return <><Header/><main className="auth-panel"><ShieldCheck size={36}/><span className="eyebrow">مساحة الفريق الخاصة</span><h1>أهلاً بفريق VG+</h1><p>سجّل الدخول بحسابك الفردي للاطلاع على الرسائل ومناقشتها مع الفريق.</p><a className="primary" href={chatGPTSignInPath('/admin')} target="_top">تسجيل الدخول عبر ChatGPT <ArrowUpLeft size={18}/></a><small>الوصول متاح للأعضاء الذين أضافهم مدير الفريق فقط.</small><a className="team-link" href="/">العودة لصندوق التواصل</a></main><Footer/></>;
 let me;try{me=await member();}catch(e){return <><Header/><main className="auth-panel"><ShieldX size={36}/><h1>الوصول إلى لوحة الفريق</h1><p>{e instanceof ApiError?e.message:'تعذر الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.'}</p><p dir="ltr">{user.email}</p><a className="secondary" href={chatGPTSignOutPath('/admin')} target="_top">تبديل الحساب</a><a className="team-link" href="/">العودة للرئيسية</a></main><Footer/></>;}
 return <><Header/><Dashboard me={me}/><Footer/></>;
}
