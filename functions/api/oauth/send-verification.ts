/**
 * POST /api/oauth/send-verification
 * Body: { email: string }
 *
 * Generate email verification token + send verify link via Resend (best-effort).
 *
 * Anti-enumeration：response 永遠 generic 200。Email 不存在或已驗證的 case 都
 * 不洩漏給 caller — 只有真正 unverified user 才產 token。
 *
 * Flow:
 *   1. lowercase email
 *   2. SELECT users WHERE email = ? AND email_verified_at IS NULL
 *   3. 若 found：產 token + D1Adapter upsert (24h TTL per V2-P2 spec) + send email
 *   4. 若 not found / already verified：silently no-op
 *   5. Always return 200 generic
 *
 * Verify link: {origin}/api/oauth/verify?token={token}
 */
import { D1Adapter } from '../../../src/server/oauth-d1-adapter';
import { parseJsonBody, generateOpaqueToken } from '../_utils';
import { sendEmail, EmailError } from '../../../src/server/email';
import { emailVerification } from '../../../src/server/email-templates';
import type { Env } from '../_types';

interface SendVerificationBody {
  email?: string;
}

const EMAIL_VERIFY_TOKEN_TTL_SEC = 24 * 60 * 60; // 24h per V2-P2 spec

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = (await parseJsonBody<SendVerificationBody>(context.request)) ?? {};
  const email = (body.email ?? '').trim().toLowerCase();

  const genericResponse = new Response(
    JSON.stringify({ ok: true, message: '若帳號需要驗證，驗證信會寄至信箱' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

  if (!email) return genericResponse;

  // Look up unverified user (joined to display_name for email greeting)
  const user = await context.env.DB
    .prepare(
      `SELECT id, display_name
       FROM users
       WHERE email = ? AND email_verified_at IS NULL LIMIT 1`,
    )
    .bind(email)
    .first<{ id: string; display_name: string | null }>();

  if (!user) {
    // Either email doesn't exist or already verified — silent no-op
    return genericResponse;
  }

  // Generate + store token
  const token = generateOpaqueToken();
  const adapter = new D1Adapter(context.env.DB, 'EmailVerification');
  await adapter.upsert(
    token,
    { userId: user.id, email, createdAt: Date.now() },
    EMAIL_VERIFY_TOKEN_TTL_SEC,
  );

  // Send verification email — best-effort (token stays in D1 even if email fails)
  if (context.env.RESEND_API_KEY && context.env.EMAIL_FROM) {
    const origin = new URL(context.request.url).origin;
    const verifyUrl = `${origin}/api/oauth/verify?token=${encodeURIComponent(token)}`;
    const tpl = emailVerification(verifyUrl, user.display_name);
    try {
      await sendEmail(context.env, {
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
    } catch (err) {
      // best-effort: log but still return generic 200 (anti-enum + token in D1 valid)
      // eslint-disable-next-line no-console
      console.error('[send-verification] email send failed:',
        err instanceof EmailError ? `${err.status} ${err.message}` : (err as Error).message);
    }
  }

  return genericResponse;
};
