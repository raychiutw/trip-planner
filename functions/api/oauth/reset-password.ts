/**
 * POST /api/oauth/reset-password
 * Body: { token: string, password: string }
 *
 * V2-P3 — verify reset token + update password_hash + destroy token (one-time use)。
 *
 * Flow:
 *   1. Validate token + password format
 *   2. D1Adapter find token (oauth_models name='PasswordReset')
 *   3. If not found / expired / used → 400 RESET_TOKEN_INVALID
 *   4. hashPassword(new password) → UPDATE auth_identities WHERE user_id = ?
 *   5. destroy token (one-time use, atomic via D1Adapter.destroy)
 *   6. Return 200 (caller redirect to /login)
 *
 * 不 issue session 自動：force user 用新密碼 explicit login，verify 他記得新密碼。
 *
 * Future (V2-P3 next slice): 加 session revoke — invalidate all existing sessions
 * for this user (V2-P5 oauth_models Session table)。
 */
import { D1Adapter } from '../../../src/server/oauth-d1-adapter';
import { hashPassword } from '../../../src/server/password';
import { parseJsonBody } from '../_utils';
import { sendEmail, EmailError } from '../../../src/server/email';
import { passwordChangedConfirm } from '../../../src/server/email-templates';
import type { Env } from '../_types';

interface ResetBody {
  token?: string;
  password?: string;
}

interface ResetTokenPayload {
  userId: string;
  email: string;
  createdAt: number;
  used?: boolean;
  [key: string]: unknown;
}

const MIN_PASSWORD_LEN = 8;

function errorResponse(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = (await parseJsonBody<ResetBody>(context.request)) ?? {};
  const token = (body.token ?? '').trim();
  const password = body.password ?? '';

  if (!token) {
    return errorResponse('RESET_TOKEN_MISSING', '缺少 token', 400);
  }
  if (!password || password.length < MIN_PASSWORD_LEN) {
    return errorResponse('RESET_INVALID_PASSWORD', `密碼至少 ${MIN_PASSWORD_LEN} 字元`, 400);
  }

  const adapter = new D1Adapter(context.env.DB, 'PasswordReset');
  const tokenRow = (await adapter.find(token)) as ResetTokenPayload | undefined;

  if (!tokenRow) {
    return errorResponse('RESET_TOKEN_INVALID', '重設連結已過期或無效', 400);
  }

  // One-time use safeguard
  if (tokenRow.used) {
    return errorResponse('RESET_TOKEN_INVALID', '重設連結已使用，請重新申請', 400);
  }

  // Hash + UPDATE
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch {
    return errorResponse('RESET_INVALID_PASSWORD', '密碼格式不符', 400);
  }

  await context.env.DB
    .prepare(
      `UPDATE auth_identities
       SET password_hash = ?, password_algo = ?, last_used_at = ?
       WHERE user_id = ? AND provider = 'local'`,
    )
    .bind(passwordHash, 'pbkdf2', new Date().toISOString(), tokenRow.userId)
    .run();

  // Destroy token (one-time use guard)
  await adapter.destroy(token);

  // Send confirmation email — best-effort，不擋成功 response
  if (context.env.RESEND_API_KEY && context.env.EMAIL_FROM) {
    try {
      const userRow = await context.env.DB
        .prepare('SELECT display_name FROM users WHERE id = ?')
        .bind(tokenRow.userId)
        .first<{ display_name: string | null }>();
      const tpl = passwordChangedConfirm(userRow?.display_name ?? null);
      await sendEmail(context.env, {
        to: tokenRow.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
    } catch (err) {
      // best-effort
      // eslint-disable-next-line no-console
      console.error('[reset-password] confirmation email failed:',
        err instanceof EmailError ? `${err.status} ${err.message}` : (err as Error).message);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, message: '密碼已更新，請用新密碼登入' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
};
