/**
 * /api/trips/:id/shares/:shareId — manage a single share link (v2.39.0).
 *   PATCH { action: 'revoke' } → close the link (keeps row + view_count analytics).
 *   DELETE                     → remove the link entirely.
 *
 * IDOR defence (design S6): trip_shares.id is a GLOBAL autoincrement int, so every
 * op binds `AND trip_id = ?` and requires affected-rows = 1, else 404 — a write-
 * permission check on :id alone is NOT enough (a co-editor of trip A must not touch
 * a share row belonging to trip B). Auth re-checked live (never trusts created_by).
 * PR2 expands PATCH to section/label/expiry edits + rotate.
 */
import { requireAuth, hasWritePermission } from '../../../_auth';
import { AppError } from '../../../_errors';
import { json } from '../../../_utils';
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
  if (body.action !== 'revoke') throw new AppError('DATA_VALIDATION');

  const res = await db
    .prepare("UPDATE trip_shares SET revoked_at = datetime('now') WHERE id = ? AND trip_id = ? AND revoked_at IS NULL")
    .bind(shareId, id)
    .run();
  if (!res.meta.changes) throw new AppError('DATA_NOT_FOUND'); // wrong trip / already revoked / gone
  return json({ ok: true, revoked: true });
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
