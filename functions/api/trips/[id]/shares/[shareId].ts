/**
 * /api/trips/:id/shares/:shareId — manage a single share link (v2.39.0 + v2.40.0 PR2).
 *   PATCH { action: 'revoke' }  → close the link (keeps row + view_count analytics).
 *   PATCH { action: 'rotate' }  → issue a NEW token (returns it ONCE); old URL 404s.
 *   DELETE                      → remove the link entirely.
 *
 * (Per-link section/expiry config is set at CREATE; to change, rotate or create a new
 * link — matches the signed-off panel mockup.)
 *
 * IDOR defence (design S6): trip_shares.id is a GLOBAL autoincrement int, so every op
 * binds `AND trip_id = ?` + requires affected-rows = 1, else 404. Auth re-checked live.
 */
import { requireAuth, hasWritePermission } from '../../../_auth';
import { AppError } from '../../../_errors';
import { json } from '../../../_utils';
import { generateShareToken, hashToken } from '../../../_share';
import type { Env } from '../../../_types';

async function requireTripWrite(context: Parameters<PagesFunction<Env>>[0], tripId: string) {
  const auth = requireAuth(context);
  const ok = await hasWritePermission(context.env.DB, auth, tripId, auth.isAdmin);
  if (!ok) throw new AppError('PERM_DENIED');
  return auth;
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { id, shareId } = context.params as { id: string; shareId: string };
  const db = context.env.DB;
  await requireTripWrite(context, id);
  const body = (await context.request.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === 'revoke') {
    const res = await db
      .prepare("UPDATE trip_shares SET revoked_at = datetime('now') WHERE id = ? AND trip_id = ? AND revoked_at IS NULL")
      .bind(shareId, id)
      .run();
    if (!res.meta.changes) throw new AppError('DATA_NOT_FOUND'); // wrong trip / already revoked / gone
    return json({ ok: true, revoked: true });
  }

  if (body.action === 'rotate') {
    // New token (returned once); only if the share belongs to THIS trip. UNIQUE retry.
    for (let attempt = 0; ; attempt++) {
      const token = generateShareToken();
      const tokenHash = await hashToken(token);
      try {
        const res = await db
          .prepare('UPDATE trip_shares SET token_hash = ?, revoked_at = NULL WHERE id = ? AND trip_id = ?')
          .bind(tokenHash, shareId, id)
          .run();
        if (!res.meta.changes) throw new AppError('DATA_NOT_FOUND');
        return json({ ok: true, token, url: `/s/${token}` });
      } catch (e) {
        if (e instanceof AppError) throw e;
        if (attempt >= 2 || !/UNIQUE/i.test(String(e))) throw e;
      }
    }
  }

  throw new AppError('DATA_VALIDATION');
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { id, shareId } = context.params as { id: string; shareId: string };
  const db = context.env.DB;
  await requireTripWrite(context, id);

  const res = await db
    .prepare('DELETE FROM trip_shares WHERE id = ? AND trip_id = ?')
    .bind(shareId, id)
    .run();
  if (!res.meta.changes) throw new AppError('DATA_NOT_FOUND');
  return json({ ok: true, deleted: true });
};
