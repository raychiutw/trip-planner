/**
 * PATCH /api/trips/:id/trip-pois/:tpid — 更新 trip_pois（user 覆寫欄位）
 * DELETE /api/trips/:id/trip-pois/:tpid — 刪除 trip_pois 引用
 *
 * 取代舊的 restaurants/[rid], shopping/[sid], hotels/[hid] endpoints
 */

import { logAudit, computeDiff } from '../../../_audit';
import { hasPermission, verifyTripPoiBelongsToTrip } from '../../../_auth';
import { json, getAuth, parseJsonBody, buildUpdateClause } from '../../../_utils';
import type { Env } from '../../../_types';

// trip_pois 可更新的欄位（覆寫 + 類型專屬）
const ALLOWED_FIELDS = [
  'description', 'note', 'hours', 'sort_order',
  'checkout', 'breakfast_included', 'breakfast_note',
  'price', 'reservation', 'reservation_url',
  'must_buy',
] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, tpid } = context.params as { id: string; tpid: string };
  const tripPoiId = Number(tpid);
  if (!tripPoiId || isNaN(tripPoiId)) return json({ error: 'Invalid trip_poi id' }, 400);

  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyTripPoiBelongsToTrip(db, tripPoiId, id)) {
    return json({ error: '此 trip_poi 不屬於該行程' }, 403);
  }

  const oldRow = await db.prepare('SELECT * FROM trip_pois WHERE id = ?').bind(tripPoiId).first() as Record<string, unknown> | null;
  if (!oldRow) return json({ error: 'Not found' }, 404);

  const bodyOrError = await parseJsonBody<Record<string, unknown>>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;

  const { clause, values } = buildUpdateClause(bodyOrError, ALLOWED_FIELDS as unknown as string[]);
  if (!clause) return json({ error: '無有效欄位可更新' }, 400);

  await db.prepare(`UPDATE trip_pois SET ${clause}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...values, tripPoiId).run();

  const newRow = await db.prepare('SELECT * FROM trip_pois WHERE id = ?').bind(tripPoiId).first();
  const diffJson = computeDiff(oldRow, newRow as Record<string, unknown>);

  await logAudit(db, {
    tripId: id, tableName: 'trip_pois', recordId: tripPoiId,
    action: 'update', changedBy: auth.email, diffJson,
  });

  return json(newRow);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, tpid } = context.params as { id: string; tpid: string };
  const tripPoiId = Number(tpid);
  if (!tripPoiId || isNaN(tripPoiId)) return json({ error: 'Invalid trip_poi id' }, 400);

  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyTripPoiBelongsToTrip(db, tripPoiId, id)) {
    return json({ error: '此 trip_poi 不屬於該行程' }, 403);
  }

  const oldRow = await db.prepare('SELECT * FROM trip_pois WHERE id = ?').bind(tripPoiId).first();
  if (!oldRow) return json({ error: 'Not found' }, 404);

  await db.prepare('DELETE FROM trip_pois WHERE id = ?').bind(tripPoiId).run();

  await logAudit(db, {
    tripId: id, tableName: 'trip_pois', recordId: tripPoiId,
    action: 'delete', changedBy: auth.email,
    snapshot: JSON.stringify(oldRow),
  });

  return json({ ok: true });
};
