export const SESSION_COOKIE = '__Host-vg_team';
export const EMBED_SESSION_COOKIE = '__Host-vg_team_embed';
export const SESSION_SECONDS = 8 * 60 * 60;
export function sessionCookie(token: string, embedded: boolean, maxAge = SESSION_SECONDS) {
  const name = embedded ? EMBED_SESSION_COOKIE : SESSION_COOKIE;
  const policy = embedded ? 'SameSite=None; Partitioned' : 'SameSite=Lax';
  return `${name}=${token}; Path=/; HttpOnly; Secure; ${policy}; Max-Age=${maxAge}`;
}
