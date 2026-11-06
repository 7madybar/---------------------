import { ArrowUpLeft, ShieldCheck } from 'lucide-react';
import { Brand } from './brand';
export function Header(){return <header className="site-header"><a href="/" className="brand-link" aria-label="VG+ الرئيسية"><Brand/></a><span className="header-center">مساحة لفكرتك. خطوة لنموّنا.</span><a className="team-link" href="/admin"><ShieldCheck size={15}/>دخول الفريق<ArrowUpLeft size={14}/></a></header>}
export function Footer(){return <footer className="site-footer"><span dir="ltr">© {new Date().getFullYear()} VG+ · Visionary Growth</span><span>نستمع. نتطوّر. ننمو.</span><a href="/brand-original.jpg" target="_blank" rel="noreferrer">هوية الفريق <ArrowUpLeft size={13}/></a></footer>}
