import { database } from './server';
import { DEFAULT_SESSION_HOURS, validSessionHours, type SessionPolicy } from './session-policy';
export async function sessionPolicy(): Promise<SessionPolicy> {
  const row = await database().prepare("SELECT value FROM settings WHERE key='team_session_hours'").first<{value:string}>();
  if (row) {
    try { const hours:unknown=JSON.parse(row.value); if(validSessionHours(hours))return {hours}; } catch { /* Preserve the safe default for malformed legacy settings. */ }
  }
  return {hours:DEFAULT_SESSION_HOURS};
}
