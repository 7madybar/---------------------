export const ROLES = { tech:'اللجنة التقنية', media:'لجنة الإعلام', organization:'لجنة التنظيم', visitor:'الزوار' } as const;
export const CATEGORIES = { idea:'مقترح وتطوير', report:'تقرير ومتابعة', urgent:'طلب عاجل', note:'ملاحظة', other:'أخرى' } as const;
export const STATUSES = { new:'جديدة', reviewing:'قيد المراجعة', resolved:'تمت المعالجة' } as const;
export type Submission = { id:string; role:keyof typeof ROLES; category:keyof typeof CATEGORIES; message:string; name:string|null; status:keyof typeof STATUSES; created_at:number };
export type Member = { email:string; user_id:string|null; name:string; role:'admin'|'member'; active:number; created_at:number };
