export const MAX_CODE_HOURS = 8760;
export function validCodeHours(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_CODE_HOURS);
}
