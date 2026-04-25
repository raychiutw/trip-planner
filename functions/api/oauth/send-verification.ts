/**
 * POST /api/oauth/send-verification
 * Body: { email: string }
 *
 * V2-P2 — Generate email verification token + (V2-P3 email service 接通) send link。
 *
 * Anti-enumeration：response 永遠 generic 200。Email 不存在或已驗證的 case 都
 * 不洩漏給 caller — 只有真正 unverified user 才產 token。
 *
 * Flow:
 *   1. lowercase email
 *   2. SELECT users WHERE email = ? AND email_verified_at IS NULL
 *   3. 若 found：產 token + D1Adapter upsert (24h TTL per V2-P2 spec)
 *   4. 若 not found / already verified：silently no-op
 *   5. Always return 200 generic
 *
 * V2-P3 next slice：integrate email service to actually send link
 *   {origin}/api/oauth/verify?token={token}
 */
import { D1Adapter } from '../../../src/server/oauth-d1-adapter';
import { parseJsonBody } from '../_utils';
import type { Env } from '../_types';

interface SendVerificationBody {
  email?: string;
}

const TTL_SEC = 24 * 60 * 60; // 24h per V2-P2 spec

function generateVerifyToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = (await parseJsonBody<SendVerificationBody>(context.request)) ?? {};
  const email = (body.email ?? '').trim().toLowerCase();

  const genericResponse = new Response(
    JSON.stringify({ ok: true, message: '若帳號需要驗證，驗證信會寄至信箱' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

  if (!email) return genericResponse;

  // Look up unverified user
  const user = await context.env.DB
    .prepare(
      `SELECT id FROM users WHERE email = ? AND email_verified_at IS NULL LIMIT 1`,
    )
    .bind(email)
    .first<{ id: string }>();

  if (!user) {
    // Either email doesn't exist or already verified — silent no-op
    return genericResponse;
  }

  // Generate + store token
  const token = generateVerifyToken();
  const adapter = new D1Adapter(context.env.DB, 'EmailVerification');
  await adapter.upsert(
    token,
    { userId: user.id, email, createdAt: Date.now(), used: false },
    TTL_SEC,
  );

  // V2-P3 next slice: send email with verify link {origin}/api/oauth/verify?token={token}
  // 目前 token 只 in D1, dev 用 wrangler d1 exec 看；prod 等 email send 接通。

  return genericResponse;
};
