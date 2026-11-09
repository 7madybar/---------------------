import { Header,Footer } from '@/components/chrome';
import Dashboard from '@/components/dashboard';
import CodeLogin from '@/components/code-login';
import { member,ApiError } from '@/lib/server';
import { sessionPolicy } from '@/lib/session-settings';
import { DEFAULT_SESSION_HOURS } from '@/lib/session-policy';
export const dynamic='force-dynamic';
export default async function Admin(){
 let me;
 try{me=await member();}catch(e){const policy=await sessionPolicy().catch(()=>({hours:DEFAULT_SESSION_HOURS}));return <><Header/><CodeLogin sessionHours={policy.hours} initialError={e instanceof ApiError&&e.status===401?'':e instanceof ApiError?e.message:'تعذر الاتصال بالخادم. أعد المحاولة لاحقاً.'}/><Footer/></>;}
 return <><Header/><Dashboard me={me}/><Footer/></>;
}
