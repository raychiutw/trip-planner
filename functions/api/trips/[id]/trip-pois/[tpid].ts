/**
 * PATCH /api/trips/:id/trip-pois/:tpid — 更新 trip_pois（user 覆寫欄位）
 * DELETE /api/trips/:id/trip-pois/:tpid — 刪除 trip_pois 引用
 *
 * 取代舊的 restaurants/[rid], shopping/[sid], hotels/[hid] endpoints
 */

import { logAudit, computeDiff } from '../../../_audit';
import { hasPermission, verifyTripPoiBelongsToTrip } from '../../../_auth';
import { AppError } from '../../../_errors';
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
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, tpid } = context.params as { id: string; tpid: string };
  const tripPoiId = Number(tpid);
  if (!tripPoiId || isNaN(tripPoiId)) throw new AppError('DATA_VALIDATION', 'Invalid trip_poi id');

  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  if (!await verifyTripPoiBelongsToTrip(db, tripPoiId, id)) {
    throw new AppError('PERM_DENIED', '此 trip_poi 不屬於該行程');
  }

  const oldRow = await db.prepare('SELECT * FROM trip_pois WHERE id = ?').bind(tripPoiId).first() as Record<string, unknown> | null;
  if (!oldRow) throw new AppError('DATA_NOT_FOUND');

  const bodyOrError = await parseJsonBody<Record<string, unknown>>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;

  const updateResult = buildUpdateClause(bodyOrError, ALLOWED_FIELDS as unknown as string[]);
  if (!updateResult) throw new AppError('DATA_VALIDATION', '無有效欄位可更新');

  await db.prepare(`UPDATE trip_pois SET ${updateResult.setClauses} WHERE id = ?`)
    .bind(...updateResult.values, tripPoiId).run();

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
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, tpid } = context.params as { id: string; tpid: string };
  const tripPoiId = Number(tpid);
  if (!tripPoiId || isNaN(tripPoiId)) throw new AppError('DATA_VALIDATION', 'Invalid trip_poi id');

  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  if (!await verifyTripPoiBelongsToTrip(db, tripPoiId, id)) {
    throw new AppError('PERM_DENIED', '此 trip_poi 不屬於該行程');
  }

  const oldRow = await db.prepare('SELECT * FROM trip_pois WHERE id = ?').bind(tripPoiId).first();
  if (!oldRow) throw new AppError('DATA_NOT_FOUND');

  await db.prepare('DELETE FROM trip_pois WHERE id = ?').bind(tripPoiId).run();

  await logAudit(db, {
    tripId: id, tableName: 'trip_pois', recordId: tripPoiId,
    action: 'delete', changedBy: auth.email,
    snapshot: JSON.stringify(oldRow),
  });

  return json({ ok: true });
};
