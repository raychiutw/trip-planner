/**
 * POST /api/oauth/logout
 * GET  /api/oauth/logout?redirect_after=/login
 *
 * V2-P1 logout — clearSession + redirect。
 *
 * 兩種 invocation:
 *   - POST: form/JS submit (XHR-friendly，CSRF 防護靠 SameSite=Lax cookie attr)
 *   - GET:  link click（如 Sidebar「登出」連結）— 走 GET 不需 form
 *     NOTE: GET logout 通常不被 spec rec 因 CSRF risk，但 SameSite=Lax 已防外站
 *     <a> 觸發；此 endpoint 只 clear cookie + redirect 沒副作用，可接受
 *
 * Behavior:
 *   1. clearSession (Set-Cookie Max-Age=0)
 *   2. 302 redirect to redirect_after (sanitized) or /login default
 *
 * 不做（V2 後續）：
 *   - Server-side session table revoke (V2-P5 oauth_models 整合後加)
 *   - Google session revoke (Google revocation endpoint，需 access_token)
 *   - Telemetry log on logout
 */
import { clearSession } from '../_session';
import type { Env } from '../_types';

const SAFE_REDIRECT_DEFAULT = '/login';

function sanitizeRedirect(value: string | null): string {
  if (!value) return SAFE_REDIRECT_DEFAULT;
  if (!value.startsWith('/') || value.startsWith('//')) return SAFE_REDIRECT_DEFAULT;
  return value;
}

async function buildLogoutResponse(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const redirectAfter = sanitizeRedirect(url.searchParams.get('redirect_after'));
  const response = new Response(null, {
    status: 302,
    headers: { Location: redirectAfter },
  });
  await clearSession(request, response, env);
  return response;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return buildLogoutResponse(context.request, context.env);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return buildLogoutResponse(context.request, context.env);
};
