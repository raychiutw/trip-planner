/**
 * POST /api/oauth/forgot-password
 * Body: { email: string }
 *
 * Generate password reset token + store in D1 oauth_models (name='PasswordReset')
 * + send email via Resend (best-effort).
 *
 * Security:
 *   - Always return 200 (no enum leak — 不分 email exists vs not)
 *   - Token cryptographically random (32 bytes base64url)
 *   - 1h TTL (per V2-P3 spec)
 *   - Store via D1Adapter (lazy expire on read)
 *
 * Response shape:
 *   200 { ok: true, message: '若 email 已註冊，重設連結將寄至信箱' }
 *
 * 若 email 確實存在 → token 寫進 D1 + 寄出 reset email。
 * 若 email 不存在 → 沒寫 token，但 response 一樣 (timing safe approximation：
 *   實際上 SQL lookup 仍跑，不再做 token gen 是 minor timing diff，
 *   但 password reset 不像 login 那麼 sensitive — 可接受 minor leak)。
 *
 * Reset URL: {origin}/auth/password/reset?token={token}
 */
import { D1Adapter } from '../../../src/server/oauth-d1-adapter';
import { parseJsonBody, generateOpaqueToken } from '../_utils';
import {
  checkRateLimit,
  bumpRateLimit,
  clientIp,
  RATE_LIMITS,
} from '../_rate_limit';
import { sendEmail, EmailError } from '../../../src/server/email';
import { passwordReset } from '../../../src/server/email-templates';
import { recordAuthEvent } from '../_auth_audit';
import { recordEmailEvent } from '../_audit';
import { alertAdminTelegram } from '../_alert';
import type { Env } from '../_types';

interface ForgotBody {
  email?: string;
}

const RESET_TOKEN_TTL_SEC = 60 * 60; // 1h per spec

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = (await parseJsonBody<ForgotBody>(context.request)) ?? {};
  const email = (body.email ?? '').trim().toLowerCase();

  // Generic message regardless of outcome (anti-enumeration)
  const genericResponse = new Response(
    JSON.stringify({ ok: true, message: '若 email 已註冊，重設連結將寄至信箱' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

  if (!email) return genericResponse;

  // V2-P6 rate limit: per-IP + per-email buckets
  // Per autoplan: 3/h/IP + 3/h/email — defence in depth
  // Bump regardless of email-exists-or-not（response 永遠 generic，attacker 無從分辨）
  const ipKey = `forgot-password:${clientIp(context.request)}`;
  const emailKey = `forgot-password:${email}`;

  const ipCheck = await checkRateLimit(context.env.DB, ipKey, RATE_LIMITS.FORGOT_PASSWORD);
  if (!ipCheck.ok) {
    return new Response(
      JSON.stringify({ error: { code: 'FORGOT_PASSWORD_RATE_LIMITED', message: '密碼重設請求過多，請稍後再試' } }),
      { status: 429, headers: { 'content-type': 'application/json', 'Retry-After': String(ipCheck.retryAfter) } },
    );
  }
  const emailCheck = await checkRateLimit(context.env.DB, emailKey, RATE_LIMITS.FORGOT_PASSWORD);
  if (!emailCheck.ok) {
    return new Response(
      JSON.stringify({ error: { code: 'FORGOT_PASSWORD_RATE_LIMITED', message: '此 email 重設請求過多，請稍後再試' } }),
      { status: 429, headers: { 'content-type': 'application/json', 'Retry-After': String(emailCheck.retryAfter) } },
    );
  }

  // Bump both buckets — every valid request counts (anti-enumeration: response is generic anyway)
  await bumpRateLimit(context.env.DB, ipKey, RATE_LIMITS.FORGOT_PASSWORD);
  await bumpRateLimit(context.env.DB, emailKey, RATE_LIMITS.FORGOT_PASSWORD);

  // Check if user exists with local provider
  const user = await context.env.DB
    .prepare(
      `SELECT u.id AS user_id, u.display_name FROM users u
       JOIN auth_identities ai ON ai.user_id = u.id
       WHERE u.email = ? AND ai.provider = 'local' LIMIT 1`,
    )
    .bind(email)
    .first<{ user_id: string; display_name: string | null }>();

  if (!user) {
    // Don't generate token, but return same generic response
    return genericResponse;
  }

  // Generate + store reset token
  const token = generateOpaqueToken();
  const adapter = new D1Adapter(context.env.DB, 'PasswordReset');
  await adapter.upsert(
    token,
    { userId: user.user_id, email, createdAt: Date.now(), used: false },
    RESET_TOKEN_TTL_SEC,
  );

  // 2026-05-02 cutover: sync send via mac mini tunnel + audit + telegram alert.
  // Q7 全 endpoint（含 forgot-password）失敗誠實回 500，捨棄 anti-enumeration
  // 設計（trip-planner 私人圈規模可接受）。
  const origin = new URL(context.request.url).origin;
  const resetUrl = `${origin}/auth/password/reset?token=${encodeURIComponent(token)}`;
  const tpl = passwordReset(resetUrl, user.display_name);

  try {
    const result = await sendEmail(context.env, {
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      template: 'forgot-password',
    });
    await recordEmailEvent(context.env.DB, {
      template: 'forgot-password',
      recipient: email,
      status: 'sent',
      latencyMs: result.elapsed,
    });
    await recordAuthEvent(context.env.DB, context.request, {
      eventType: 'password_reset_request',
      outcome: 'success',
      userId: user.user_id,
      metadata: { email },
    });
    return genericResponse;
  } catch (err) {
    const msg = err instanceof EmailError
      ? `${err.status} ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);
    await recordEmailEvent(context.env.DB, {
      template: 'forgot-password',
      recipient: email,
      status: 'failed',
      error: msg,
    });
    await recordAuthEvent(context.env.DB, context.request, {
      eventType: 'password_reset_request',
      outcome: 'failure',
      userId: user.user_id,
      metadata: { email, reason: 'email_send_failed', error: msg },
    });
    await alertAdminTelegram(
      context.env,
      `重設密碼信寄送失敗: ${email} (${msg})`,
    );
    return new Response(
      JSON.stringify({ error: '重設密碼信寄送失敗，請稍後再試' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }
};
