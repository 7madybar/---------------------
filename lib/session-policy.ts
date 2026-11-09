export const DEFAULT_SESSION_HOURS = 8;
export const MAX_SESSION_HOURS = 8760;
export type SessionPolicy = { hours: number | null };
export function validSessionHours(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_SESSION_HOURS);
}
export function sessionDurationText(hours: number | null) {
  if(hours===null)return 'بدون انتهاء تلقائي';
  if(hours===1)return 'ساعة واحدة';
  if(hours===2)return 'ساعتان';
  return `${hours} ${hours%100>=3&&hours%100<=10?'ساعات':'ساعة'}`;
}
