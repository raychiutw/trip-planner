/**
 * PATCH /api/trips/:id/trip-pois/:tpid — 更新 trip_pois（user 覆寫欄位）
 * DELETE /api/trips/:id/trip-pois/:tpid — 刪除 trip_pois 引用
 *
 * 取代舊的 restaurants/[rid], shopping/[sid], hotels/[hid] endpoints
 */

import { logAudit, computeDiff } from '../../../_audit';
import { hasPermission, verifyTripPoiBelongsToTrip, verifyEntryBelongsToTrip } from '../../../_auth';
import { AppError } from '../../../_errors';
import { json, getAuth, parseJsonBody, buildUpdateClause, parseIntParam } from '../../../_utils';
import type { Env } from '../../../_types';

// trip_pois 可更新的欄位（覆寫 + 類型專屬）
const ALLOWED_FIELDS = [
  'description', 'note', 'hours', 'sort_order',
  'checkout', 'breakfast_included', 'breakfast_note',
  'price', 'reservation', 'reservation_url',
  'must_buy', 'entry_id',
] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, tpid } = context.params as { id: string; tpid: string };
  const tripPoiId = parseIntParam(tpid);
  if (!tripPoiId) throw new AppError('DATA_VALIDATION', 'trip_poi ID 格式錯誤');

  const db = context.env.DB;

  const [hasPerm, belongsToTrip] = await Promise.all([
    hasPermission(db, auth.email, id, auth.isAdmin),
    verifyTripPoiBelongsToTrip(db, tripPoiId, id),
  ]);
  if (!hasPerm) throw new AppError('PERM_DENIED');
  if (!belongsToTrip) throw new AppError('PERM_DENIED', '此 trip_poi 不屬於該行程');

  const [oldRow, body] = await Promise.all([
    db.prepare('SELECT * FROM trip_pois WHERE id = ?').bind(tripPoiId).first() as Promise<Record<string, unknown> | null>,
    parseJsonBody<Record<string, unknown>>(context.request),
  ]);
  if (!oldRow) throw new AppError('DATA_NOT_FOUND');

  if (body.entry_id != null) {
    const entryId = parseIntParam(String(body.entry_id));
    if (!entryId) throw new AppError('DATA_VALIDATION', 'entry_id 格式錯誤');
    if (!await verifyEntryBelongsToTrip(db, entryId, id)) {
      throw new AppError('DATA_VALIDATION', '目標 entry 不屬於此行程');
    }
  }

  const updateResult = buildUpdateClause(body, ALLOWED_FIELDS as unknown as string[]);
  if (!updateResult) throw new AppError('DATA_VALIDATION', '無有效欄位可更新');

  const newRow = await db.prepare(`UPDATE trip_pois SET ${updateResult.setClauses} WHERE id = ? RETURNING *`)
    .bind(...updateResult.values, tripPoiId).first();
  if (!newRow) throw new AppError('SYS_INTERNAL', 'UPDATE RETURNING 未回傳資料');
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
  const tripPoiId = parseIntParam(tpid);
  if (!tripPoiId) throw new AppError('DATA_VALIDATION', 'trip_poi ID 格式錯誤');

  const db = context.env.DB;

  const [hasPerm, belongsToTrip] = await Promise.all([
    hasPermission(db, auth.email, id, auth.isAdmin),
    verifyTripPoiBelongsToTrip(db, tripPoiId, id),
  ]);
  if (!hasPerm) throw new AppError('PERM_DENIED');
  if (!belongsToTrip) throw new AppError('PERM_DENIED', '此 trip_poi 不屬於該行程');

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
