/**
 * DELETE /api/account/connected-apps/:client_id
 *
 * V2-P5 — Revoke OAuth client_app access for current user。Mockup section 4
 * 「撤銷確認」modal 觸發。
 *
 * Auth: requireSessionUser
 *
 * Behavior:
 *   1. Verify consent exists for (session.uid, client_id) — 404 if not
 *   2. Destroy consent row (D1Adapter.destroy)
 *   3. Destroy all AccessToken + RefreshToken rows for (user_id, client_id)
 *      — 立即生效，不等 access_token 1h TTL
 *
 * Response: { ok: true, revoked_client_id }
 *
 * Note: 不對外暴露 user_id（response 只有 client_id），caller 推斷自己 session
 */
import { D1Adapter } from '../../../../src/server/oauth-d1-adapter';
import { requireSessionUser } from '../../_session';
import { AppError } from '../../_errors';
import type { Env } from '../../_types';

function snakeJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const session = await requireSessionUser(context.request, context.env);
  const clientId = (context.params as { client_id?: string }).client_id;

  if (!clientId || typeof clientId !== 'string') {
    throw new AppError('DATA_VALIDATION', 'client_id 必填');
  }

  // Verify consent exists
  const consentKey = `${session.uid}:${clientId}`;
  const consentAdapter = new D1Adapter(context.env.DB, 'Consent');
  const existing = await consentAdapter.find(consentKey);
  if (!existing) {
    return snakeJson({ error: { code: 'CONSENT_NOT_FOUND', message: '此 app 未授權給你的帳號' } }, 404);
  }

  // Destroy consent
  await consentAdapter.destroy(consentKey);

  // Destroy all access + refresh tokens for this (user, client) pair
  // 立即生效（不等 access_token 1h TTL）
  await context.env.DB
    .prepare(
      `DELETE FROM oauth_models
       WHERE name IN ('AccessToken', 'RefreshToken')
         AND json_extract(payload, '$.user_id') = ?
         AND json_extract(payload, '$.client_id') = ?`,
    )
    .bind(session.uid, clientId)
    .run();

  return snakeJson({ ok: true, revoked_client_id: clientId });
};
