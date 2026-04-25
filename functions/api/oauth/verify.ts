/**
 * GET /api/oauth/verify?token=<token>
 *
 * V2-P2 — Email verification endpoint。User 點 email 連結 → 驗 token →
 * UPDATE users.email_verified_at → 302 redirect /login?verified=1。
 *
 * Flow:
 *   1. Extract token from query
 *   2. D1Adapter find token (oauth_models name='EmailVerification')
 *   3. If not found / expired / used → 302 /login?verify_error=expired
 *   4. UPDATE users SET email_verified_at = ISO_NOW WHERE id = userId
 *   5. destroy token (one-time use)
 *   6. 302 /login?verified=1
 *
 * 為什麼 GET 而不 POST：使用者點 email 連結觸發。標準 email-link 模式都用 GET。
 * Token 在 URL（不在 body）的安全考量：
 *   - referrer leak：依靠 V2-P5 callback page 加 Referrer-Policy: no-referrer
 *   - browser history：token 確實會留 history。短 TTL (24h) + one-time-use 限制 risk
 */
import { D1Adapter } from '../../../src/server/oauth-d1-adapter';
import type { Env } from '../_types';

interface VerifyTokenPayload {
  userId: string;
  email: string;
  createdAt: number;
  used?: boolean;
  [key: string]: unknown;
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location },
  });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const token = (url.searchParams.get('token') ?? '').trim();

  if (!token) {
    return redirect('/login?verify_error=missing_token');
  }

  const adapter = new D1Adapter(context.env.DB, 'EmailVerification');
  const tokenRow = (await adapter.find(token)) as VerifyTokenPayload | undefined;

  if (!tokenRow) {
    return redirect('/login?verify_error=expired');
  }
  if (tokenRow.used) {
    return redirect('/login?verify_error=used');
  }

  // Mark user verified
  try {
    await context.env.DB
      .prepare('UPDATE users SET email_verified_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), tokenRow.userId)
      .run();
  } catch {
    // DB failure — token still valid, user can retry. Don't burn token.
    return redirect('/login?verify_error=server_error');
  }

  // Destroy token (one-time use)
  await adapter.destroy(token);

  return redirect('/login?verified=1');
};
