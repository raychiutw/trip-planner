/**
 * POST /api/oauth/signup
 * Body: { email: string, password: string, displayName?: string }
 *
 * V2-P2 — Local password account creation。建 user + auth_identities (provider='local')
 * 並立即 issueSession。
 *
 * Email verification 暫不 enforce（user_verified_at 留 null）— V2-P2 next slice
 * 加 verification email + confirm endpoint，login 時 enforce verified。
 *
 * Security:
 *   - hashPassword（PBKDF2-SHA256 600k iter，src/server/password.ts）
 *   - Constant-time email duplicate check via UNIQUE constraint trap
 *   - Rate limit deferred V2-P6（middleware level）
 *
 * Error codes:
 *   400 SIGNUP_INVALID_EMAIL / SIGNUP_INVALID_PASSWORD
 *   409 SIGNUP_EMAIL_TAKEN
 *   500 SYS_INTERNAL (DB error / SESSION_SECRET 缺)
 */
import { issueSession } from '../_session';
import { AppError } from '../_errors';
import { parseJsonBody } from '../_utils';
import { hashPassword } from '../../../src/server/password';
import { recordAuthEvent } from '../_auth_audit';
import type { Env } from '../_types';

interface SignupBody {
  email?: string;
  password?: string;
  displayName?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

function errorResponse(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = (await parseJsonBody<SignupBody>(context.request)) ?? {};
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const displayName = body.displayName?.trim() || null;

  // Validation
  if (!email || !EMAIL_REGEX.test(email)) {
    return errorResponse('SIGNUP_INVALID_EMAIL', 'Email 格式無效', 400);
  }
  if (!password || password.length < MIN_PASSWORD_LEN) {
    return errorResponse('SIGNUP_INVALID_PASSWORD', `密碼至少 ${MIN_PASSWORD_LEN} 字元`, 400);
  }

  // Duplicate email check
  const existing = await context.env.DB
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>();
  if (existing) {
    await recordAuthEvent(context.env.DB, context.request, {
      eventType: 'signup',
      outcome: 'failure',
      failureReason: 'email_taken',
      metadata: { email },
    });
    return errorResponse('SIGNUP_EMAIL_TAKEN', '此 email 已註冊，請改用登入或忘記密碼', 409);
  }

  // Hash + INSERT
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch {
    return errorResponse('SIGNUP_INVALID_PASSWORD', '密碼格式不符', 400);
  }

  const userId = crypto.randomUUID();
  try {
    await context.env.DB
      .prepare('INSERT INTO users (id, email, email_verified_at, display_name) VALUES (?, ?, ?, ?)')
      .bind(userId, email, null, displayName)
      .run();
    await context.env.DB
      .prepare(
        `INSERT INTO auth_identities
           (user_id, provider, provider_user_id, password_hash, password_algo, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(userId, 'local', email, passwordHash, 'pbkdf2', new Date().toISOString())
      .run();
  } catch (err) {
    // Race condition：同時兩個 signup 同 email — UNIQUE constraint trap
    const msg = (err as Error).message ?? '';
    if (msg.toUpperCase().includes('UNIQUE')) {
      return errorResponse('SIGNUP_EMAIL_TAKEN', '此 email 已註冊（race condition）', 409);
    }
    throw new AppError('SYS_INTERNAL', `Signup INSERT 失敗：${msg.slice(0, 200)}`);
  }

  // Issue session immediately（V2-P2 後續若 enforce email verify，這 session 仍
  // valid，只是 user 看到 banner 提示驗證 email）
  const response = new Response(
    JSON.stringify({ ok: true, userId, email, requiresVerification: true }),
    { status: 201, headers: { 'content-type': 'application/json' } },
  );
  await issueSession(context.request, response, userId, context.env);

  // V2-P6 audit log — best-effort, don't fail signup if audit insert fails
  await recordAuthEvent(context.env.DB, context.request, {
    eventType: 'signup',
    outcome: 'success',
    userId,
    metadata: { email, displayName },
  });
  return response;
};
