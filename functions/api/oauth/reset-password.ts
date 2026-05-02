/**
 * POST /api/oauth/reset-password
 * Body: { token: string, password: string }
 *
 * Verify reset token + update password_hash + consume token + revoke all
 * existing sessions for the user (force re-login on the new password).
 *
 * Flow:
 *   1. Validate token + password format
 *   2. D1Adapter find token (oauth_models name='PasswordReset')
 *   3. If not found / expired / used → 400 RESET_TOKEN_INVALID
 *   4. hashPassword(new password) → UPDATE auth_identities WHERE user_id = ?
 *   5. consume token (one-time-use; row kept until expires_at so re-clicks see 'used')
 *   6. revokeAllOtherSessions(uid, null) — wipe ALL sessions so attacker holding
 *      a previously-stolen session cookie loses access immediately.
 *   7. Return 200 (caller redirect to /login)
 *
 * 不 issue session 自動：force user 用新密碼 explicit login，verify 他記得新密碼。
 */
import { D1Adapter } from '../../../src/server/oauth-d1-adapter';
import { hashPassword, MIN_PASSWORD_LEN } from '../../../src/server/password';
import { parseJsonBody } from '../_utils';
import { revokeAllOtherSessions } from '../_session';
import { sendEmail, EmailError } from '../../../src/server/email';
import { recordEmailEvent } from '../_audit';
import { alertAdminTelegram } from '../_alert';
import { passwordChangedConfirm } from '../../../src/server/email-templates';
import { recordAuthEvent } from '../_auth_audit';
import type { Env } from '../_types';

interface ResetBody {
  token?: string;
  password?: string;
}

interface ResetTokenPayload {
  userId: string;
  email: string;
  createdAt: number;
  /** Set on consume (matches D1Adapter.consume()'s field name). Re-clicks see this. */
  consumed?: number;
  /** Legacy field — older code wrote `used` instead of `consumed`. Read both. */
  used?: boolean;
  [key: string]: unknown;
}

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
    return errorResponse('RESET_PASSWORD_TOO_SHORT', `密碼至少 ${MIN_PASSWORD_LEN} 字元`, 400);
  }

  const adapter = new D1Adapter(context.env.DB, 'PasswordReset');
  const tokenRow = (await adapter.find(token)) as ResetTokenPayload | undefined;

  if (!tokenRow) {
    await recordAuthEvent(context.env.DB, context.request, {
      eventType: 'password_reset_complete',
      outcome: 'failure',
      failureReason: 'invalid_token',
    });
    return errorResponse('RESET_TOKEN_INVALID', '重設連結已過期或無效', 400);
  }

  // One-time use safeguard (handle both legacy `used:true` rows and new `consumed:<ts>`)
  if (tokenRow.consumed || tokenRow.used) {
    await recordAuthEvent(context.env.DB, context.request, {
      eventType: 'password_reset_complete',
      outcome: 'failure',
      userId: tokenRow.userId,
      failureReason: 'token_used',
    });
    return errorResponse('RESET_TOKEN_INVALID', '重設連結已使用，請重新申請', 400);
  }

  // Hash + UPDATE
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch {
    return errorResponse('RESET_PASSWORD_FORMAT', '密碼格式不符', 400);
  }

  await context.env.DB
    .prepare(
      `UPDATE auth_identities
       SET password_hash = ?, password_algo = ?, last_used_at = ?
       WHERE user_id = ? AND provider = 'local'`,
    )
    .bind(passwordHash, 'pbkdf2', new Date().toISOString(), tokenRow.userId)
    .run();

  // Mark token consumed (kept until expires_at so re-clicks return 'used')
  await adapter.consume(token);

  // Revoke ALL existing sessions for this user — security boundary: an attacker
  // who held a stolen session cookie loses access the moment the user resets
  // their password. Pass null as currentSid → "revoke all".
  try {
    await revokeAllOtherSessions(context.env.DB, tokenRow.userId, null);
  } catch (err) {
    // best-effort — table missing or other error doesn't block password update.
    // eslint-disable-next-line no-console
    console.error('[reset-password] revokeAllOtherSessions failed:', (err as Error).message);
  }

  // Send confirmation email — best-effort（密碼已更新，不擋 user 的 200 response）。
  // Q7 例外：confirmation 是「事後通知」非「primary deliverable」，回 500 會讓
  // user 誤以為密碼沒改成功 → 重複嘗試。改成 best-effort + audit + telegram alert
  // 給 admin observable 即可。
  const userRow = await context.env.DB
    .prepare('SELECT display_name FROM users WHERE id = ?')
    .bind(tokenRow.userId)
    .first<{ display_name: string | null }>();
  const tpl = passwordChangedConfirm(userRow?.display_name ?? null);
  try {
    const result = await sendEmail(context.env, {
      to: tokenRow.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      template: 'reset-password-confirm',
    });
    await recordEmailEvent(context.env.DB, {
      template: 'reset-password-confirm',
      recipient: tokenRow.email,
      status: 'sent',
      latencyMs: result.elapsed,
      triggeredBy: tokenRow.email,
    });
  } catch (err) {
    const msg = err instanceof EmailError
      ? `${err.status} ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);
    await recordEmailEvent(context.env.DB, {
      template: 'reset-password-confirm',
      recipient: tokenRow.email,
      status: 'failed',
      error: msg,
      triggeredBy: tokenRow.email,
    });
    await alertAdminTelegram(
      context.env,
      `密碼重設確認信寄送失敗（password 已更新）: ${tokenRow.email} (${msg})`,
    );
  }

  await recordAuthEvent(context.env.DB, context.request, {
    eventType: 'password_reset_complete',
    outcome: 'success',
    userId: tokenRow.userId,
    metadata: { email: tokenRow.email },
  });

  return new Response(
    JSON.stringify({ ok: true, message: '密碼已更新，請用新密碼登入' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
};
