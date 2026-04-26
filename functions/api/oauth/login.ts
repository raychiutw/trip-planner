/**
 * POST /api/oauth/login
 * Body: { email: string, password: string }
 *
 * V2-P2 — Local password login。verify password → issueSession。
 *
 * Security:
 *   - Generic 401 LOGIN_INVALID 不分 email-not-found vs wrong-password
 *     (避免 email enumeration attack)
 *   - 失敗仍跑 verifyPassword 的 hash compute 避免 timing oracle leak
 *     (constant time guarantee — fake hash for unknown email)
 *   - Rate limit deferred V2-P6
 *   - Update auth_identities.last_used_at on success
 *
 * Error codes:
 *   400 LOGIN_INVALID_INPUT
 *   401 LOGIN_INVALID  (generic — 防 email enumeration)
 *   500 SYS_INTERNAL
 */
import { issueSession } from '../_session';
import { parseJsonBody } from '../_utils';
import { verifyPassword, getStaticProbeHash } from '../../../src/server/password';
import {
  checkRateLimit,
  bumpRateLimit,
  resetRateLimit,
  clientIp,
  RATE_LIMITS,
} from '../_rate_limit';
import { recordAuthEvent } from '../_auth_audit';
import type { Env } from '../_types';

interface LoginBody {
  email?: string;
  password?: string;
}

interface AuthIdentityRow {
  user_id: string;
  password_hash: string | null;
}

function errorResponse(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = (await parseJsonBody<LoginBody>(context.request)) ?? {};
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  if (!email || !password) {
    return errorResponse('LOGIN_INVALID_INPUT', 'email + password 必填', 400);
  }

  // V2-P6 rate limit: per-IP + per-email buckets (defence in depth)
  const ipKey = `login:${clientIp(context.request)}`;
  const emailKey = `login:${email}`;

  const ipCheck = await checkRateLimit(context.env.DB, ipKey, RATE_LIMITS.LOGIN);
  if (!ipCheck.ok) {
    return new Response(
      JSON.stringify({ error: { code: 'LOGIN_RATE_LIMITED', message: '登入嘗試過多，請稍後再試' } }),
      { status: 429, headers: { 'content-type': 'application/json', 'Retry-After': String(ipCheck.retryAfter) } },
    );
  }
  const emailCheck = await checkRateLimit(context.env.DB, emailKey, RATE_LIMITS.LOGIN);
  if (!emailCheck.ok) {
    return new Response(
      JSON.stringify({ error: { code: 'LOGIN_RATE_LIMITED', message: '此 email 登入嘗試過多，請稍後再試' } }),
      { status: 429, headers: { 'content-type': 'application/json', 'Retry-After': String(emailCheck.retryAfter) } },
    );
  }

  // Lookup local provider identity
  const identity = await context.env.DB
    .prepare(
      `SELECT user_id, password_hash FROM auth_identities
       WHERE provider = ? AND provider_user_id = ?`,
    )
    .bind('local', email)
    .first<AuthIdentityRow>();

  // Always run verifyPassword (real hash if found, fake if not) — constant-time guarantee
  const hashToCheck = identity?.password_hash ?? (await getStaticProbeHash());
  const passwordOk = await verifyPassword(password, hashToCheck);

  if (!identity || !passwordOk) {
    // Bump both buckets on failure (defence in depth)
    await bumpRateLimit(context.env.DB, ipKey, RATE_LIMITS.LOGIN);
    await bumpRateLimit(context.env.DB, emailKey, RATE_LIMITS.LOGIN);
    await recordAuthEvent(context.env.DB, context.request, {
      eventType: 'login',
      outcome: 'failure',
      userId: identity?.user_id ?? null,
      failureReason: !identity ? 'unknown_email' : 'wrong_password',
      metadata: { email },
    });
    return errorResponse('LOGIN_INVALID', 'email 或密碼錯誤', 401);
  }

  // Success: reset counters (legitimate user not penalised by past failed attempts)
  await resetRateLimit(context.env.DB, ipKey);
  await resetRateLimit(context.env.DB, emailKey);

  // Update last_used_at (best effort, don't fail login if update errors)
  try {
    await context.env.DB
      .prepare(
        `UPDATE auth_identities SET last_used_at = ? WHERE provider = ? AND provider_user_id = ?`,
      )
      .bind(new Date().toISOString(), 'local', email)
      .run();
  } catch {
    // ignore — login still succeeds
  }

  const response = new Response(
    JSON.stringify({ ok: true, userId: identity.user_id, email }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
  await issueSession(context.request, response, identity.user_id, context.env);

  await recordAuthEvent(context.env.DB, context.request, {
    eventType: 'login',
    outcome: 'success',
    userId: identity.user_id,
    metadata: { email },
  });
  return response;
};
