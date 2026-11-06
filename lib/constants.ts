export const ROLES = { tech:'اللجنة التقنية', media:'لجنة الإعلام', organization:'لجنة التنظيم', visitor:'الزوار' } as const;
export const CATEGORIES = { idea:'مقترح وتطوير', report:'تقرير ومتابعة', urgent:'طلب عاجل', note:'ملاحظة', other:'أخرى' } as const;
export const STATUSES = { new:'جديدة', reviewing:'قيد المراجعة', resolved:'تمت المعالجة' } as const;
export type Submission = { id:string; role:keyof typeof ROLES; category:keyof typeof CATEGORIES; message:string; name:string|null; status:keyof typeof STATUSES; created_at:number };
export const TEAM_ROLES = {owner:'المالك',admin:'المدير',member:'العضو'} as const;
export type Member = { email:string; user_id:string|null; name:string; role:keyof typeof TEAM_ROLES; active:number; created_at:number };
export type TeamMember = { id:string; name:string; role:Member['role']; active:number; created_at:number; self:boolean };
