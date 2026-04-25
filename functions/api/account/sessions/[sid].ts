/**
 * DELETE /api/account/sessions/:sid — revoke specific session by sid
 *
 * V2-P6 multi-device session management。允許 user 從 list 點某 device 「登出」。
 *
 * Auth: requireSessionUser
 * Ownership: SQL 內 WHERE user_id 強制只能 revoke 自己的 session
 *   （cross-user 攻擊 user A 試圖 DELETE user B 的 sid → SQL no-op，no rows changed）
 *
 * Response:
 *   200 { ok: true } 若 revoke 成功
 *   404 { error: 'SESSION_NOT_FOUND' } 若 sid 不屬於 current user 或已 revoked
 *
 * 撤銷自己當前 session：允許 — 等同 logout（cookie 仍在 client，但下次 request
 * 會被 getSessionUser 的 revocation check 擋）。
 */
import { requireSessionUser } from '../../_session';
import { rawJson } from '../../_utils';
import { AppError } from '../../_errors';
import type { Env } from '../../_types';

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const session = await requireSessionUser(context.request, context.env);
  const sid = (context.params as { sid?: string }).sid;
  if (!sid || typeof sid !== 'string') {
    throw new AppError('DATA_VALIDATION', 'sid 必填');
  }

  const result = await context.env.DB
    .prepare(
      `UPDATE session_devices
       SET revoked_at = datetime('now')
       WHERE sid = ? AND user_id = ? AND revoked_at IS NULL`,
    )
    .bind(sid, session.uid)
    .run();

  const changes = (result.meta as { changes?: number } | undefined)?.changes ?? 0;
  if (changes === 0) {
    return rawJson(
      { error: { code: 'SESSION_NOT_FOUND', message: '找不到此 session（可能已登出或不屬於你）' } },
      404,
    );
  }

  return rawJson({ ok: true, revoked_sid: sid });
};
