/**
 * GET /api/oauth/userinfo — return current session user
 *
 * V2-P1 — SPA 用此 endpoint 在 page load 取得 logged-in user info（取代
 * sidebar hardcode email）。OIDC userinfo endpoint 通常 return token claims；
 * 這裡 V2-P1 階段 return D1 users row 的 subset。
 *
 * Auth: required (session cookie)。沒 session → 401。
 *
 * Response shape (200):
 *   { id, email, displayName?, avatarUrl?, emailVerified: boolean, createdAt }
 *
 * 不含：refresh token / Google profile direct passthrough（V2-P5 OIDC server
 * mode 才回 standard OIDC userinfo claims）
 */
import { requireSessionUser } from '../_session';
import { AppError } from '../_errors';
import type { Env } from '../_types';

interface UserRow {
  id: string;
  email: string;
  email_verified_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSessionUser(context.request, context.env);

  const row = await context.env.DB
    .prepare(
      'SELECT id, email, email_verified_at, display_name, avatar_url, created_at FROM users WHERE id = ?',
    )
    .bind(session.uid)
    .first<UserRow>();

  if (!row) {
    // Session 指向已不存在的 user — 可能 user 被 admin 刪了 / DB 出錯
    throw new AppError('AUTH_INVALID', 'Session user 不存在');
  }

  return new Response(
    JSON.stringify({
      id: row.id,
      email: row.email,
      emailVerified: row.email_verified_at !== null,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
    }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // Don't cache — user 資料可能變動
        'cache-control': 'private, no-store',
      },
    },
  );
};
