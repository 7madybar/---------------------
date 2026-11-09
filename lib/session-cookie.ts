export const SESSION_COOKIE = '__Host-vg_team';
export const EMBED_SESSION_COOKIE = '__Host-vg_team_embed';
export const SESSION_SECONDS = 8 * 60 * 60;
// Browsers may cap persistent cookie lifetimes or clear them earlier.
// The database uses expires_at=0 for sessions with no automatic server expiry.
export const PERSISTENT_COOKIE_SECONDS = 400 * 24 * 60 * 60;
export function sessionCookie(token: string, embedded: boolean, maxAge = SESSION_SECONDS) {
  const name = embedded ? EMBED_SESSION_COOKIE : SESSION_COOKIE;
  const policy = embedded ? 'SameSite=None; Partitioned' : 'SameSite=Lax';
  return `${name}=${token}; Path=/; HttpOnly; Secure; ${policy}; Max-Age=${maxAge}`;
}
