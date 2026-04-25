/**
 * Cookie helpers — V2-P1 session cookie 操作
 *
 * 提供 typesafe getter / setter / clearer for `tripline_session` cookie，
 * 配合 src/server/session.ts 的 sign/verify token 使用。
 *
 * Cookie 屬性：
 *   - HttpOnly：JS 不能讀（防 XSS 偷 token）
 *   - Secure：只 HTTPS 傳（local dev 用 SameSite=Lax 仍 work over http）
 *   - SameSite=Lax：跨站 GET 帶 cookie（OAuth redirect callback 需要），
 *     但 form POST 等 cross-site 不帶 — 防 CSRF（搭配 token 內的 csrf 欄位）
 *   - Path=/：全站可讀（API + SPA）
 *   - Max-Age：跟 token 內 exp 對齊（session module 預設 30 天）
 */

const COOKIE_NAME = 'tripline_session';
const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, sec

/** Parse Cookie header → 取 tripline_session 的 value（沒有則 null） */
export function getSessionCookie(request: Request): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  const cookies = header.split(';').map((c) => c.trim());
  for (const c of cookies) {
    const [key, ...rest] = c.split('=');
    if (key?.trim() === COOKIE_NAME) return rest.join('=');
  }
  return null;
}

/**
 * Build Set-Cookie header value for session cookie。
 *
 * 注意：CF Workers Response.headers 不支援 setCookie API，要 append 到
 * 'Set-Cookie' header。caller 自行 `response.headers.append('Set-Cookie', value)`。
 */
export function buildSessionSetCookie(token: string, options: { maxAge?: number; secure?: boolean } = {}): string {
  const maxAge = options.maxAge ?? DEFAULT_MAX_AGE;
  // Local dev (http://localhost) 不該設 Secure，否則 cookie 不傳。生產一定要 Secure。
  const secure = options.secure ?? true;
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/** Build Set-Cookie header value to clear session（logout） */
export function buildClearSessionSetCookie(secure = true): string {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/** 判斷 request URL 是否應設 Secure cookie（http://localhost 不該）。 */
export function shouldSetSecure(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === 'https:';
}
