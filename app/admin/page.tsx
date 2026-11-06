import { Header,Footer } from '@/components/chrome';
import Dashboard from '@/components/dashboard';
import CodeLogin from '@/components/code-login';
import { member,ApiError } from '@/lib/server';
export const dynamic='force-dynamic';
export default async function Admin(){
 let me;
 try{me=await member();}catch(e){return <><Header/><CodeLogin initialError={e instanceof ApiError&&e.status===401?'':e instanceof ApiError?e.message:'تعذر الاتصال بالخادم. أعد المحاولة لاحقاً.'}/><Footer/></>;}
 return <><Header/><Dashboard me={me}/><Footer/></>;
}
