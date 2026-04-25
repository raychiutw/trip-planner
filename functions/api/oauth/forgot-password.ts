/**
 * POST /api/oauth/forgot-password
 * Body: { email: string }
 *
 * V2-P3 first slice — generate password reset token + store in D1 oauth_models
 * (name='PasswordReset')。Email send 留 V2-P3 next slice (need email service).
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
 * 若 email 確實存在 → token 已寫進 D1 + (V2-P3 next) email queue。
 * 若 email 不存在 → 沒寫 token，但 response 一樣 (timing safe approximation：
 *   實際上 SQL lookup 仍跑，不再做 token gen 是 minor timing diff，
 *   但 password reset 不像 login 那麼 sensitive — 可接受 minor leak)。
 *
 * Token format: cryptographically random 32-byte base64url。
 *   D1 row payload: { userId, email, createdAt, used: false }
 */
import { D1Adapter } from '../../../src/server/oauth-d1-adapter';
import { parseJsonBody } from '../_utils';
import { recordAuthEvent } from '../_auth_audit';
import type { Env } from '../_types';

interface ForgotBody {
  email?: string;
}

const TTL_SEC = 60 * 60; // 1h per spec

function generateResetToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = (await parseJsonBody<ForgotBody>(context.request)) ?? {};
  const email = (body.email ?? '').trim().toLowerCase();

  // Generic message regardless of outcome (anti-enumeration)
  const genericResponse = new Response(
    JSON.stringify({ ok: true, message: '若 email 已註冊，重設連結將寄至信箱' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

  if (!email) return genericResponse;

  // Check if user exists with local provider
  const user = await context.env.DB
    .prepare(
      `SELECT u.id AS user_id FROM users u
       JOIN auth_identities ai ON ai.user_id = u.id
       WHERE u.email = ? AND ai.provider = 'local' LIMIT 1`,
    )
    .bind(email)
    .first<{ user_id: string }>();

  if (!user) {
    // Don't generate token, but return same generic response
    return genericResponse;
  }

  // Generate + store reset token
  const token = generateResetToken();
  const adapter = new D1Adapter(context.env.DB, 'PasswordReset');
  await adapter.upsert(
    token,
    { userId: user.user_id, email, createdAt: Date.now(), used: false },
    TTL_SEC,
  );

  await recordAuthEvent(context.env.DB, context.request, {
    eventType: 'password_reset_request',
    outcome: 'success',
    userId: user.user_id,
    metadata: { email },
  });

  return genericResponse;
};
