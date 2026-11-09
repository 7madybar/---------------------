import { STATUSES,type StatusEvent } from '@/lib/constants';
const date=(n:number)=>new Intl.DateTimeFormat('ar-LY',{dateStyle:'medium',timeStyle:'short'}).format(new Date(n*1000));
export default function StatusTimeline({history}:{history:StatusEvent[]}){
  return <ol className="status-timeline" aria-label="سجل حالات الرسالة">{history.map((event,index)=><li key={index}>
    <strong>{STATUSES[event.status]}</strong>
    <span>{event.changed_by?`حدّد الحالة: ${event.changed_by}`:index===0?'استُلمت الرسالة آلياً':'صاحب التغيير غير مسجّل'}</span>
    {event.changed_at!==null?<time dateTime={new Date(event.changed_at*1000).toISOString()}>{date(event.changed_at)}</time>:<span>التاريخ غير مسجّل لهذه الحالة القديمة</span>}
  </li>)}</ol>;
}
