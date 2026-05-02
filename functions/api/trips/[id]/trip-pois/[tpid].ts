/**
 * PATCH /api/trips/:id/trip-pois/:tpid — 更新 trip_pois（user 覆寫欄位）
 * DELETE /api/trips/:id/trip-pois/:tpid — 刪除 trip_pois 引用
 *
 * 取代舊的 restaurants/[rid], shopping/[sid], hotels/[hid] endpoints
 */

import { logAudit, computeDiff } from '../../../_audit';
import { hasWritePermission, verifyTripPoiBelongsToTrip, verifyEntryBelongsToTrip } from '../../../_auth';
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

// 2026-05-02 OSM PR (commit 11): pois master 專屬欄位 — 偵測到後自動 dispatch
// 到 PATCH /pois/:id (避免 silent no-op，前端誤把 master 欄位送到 trip_pois)。
// description/note/hours 是 overlap (trip_pois 也有同名欄位作為覆寫) — 留在
// trip_pois ALLOWED_FIELDS，視為 user 想做 override。
const POI_MASTER_ONLY_FIELDS = [
  'name', 'address', 'phone', 'email', 'website',
  'rating', 'category', 'mapcode', 'lat', 'lng',
  'country', 'source',
  'osm_id', 'osm_type', 'wikidata_id', 'cuisine', 'data_source',
] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, tpid } = context.params as { id: string; tpid: string };
  const tripPoiId = parseIntParam(tpid);
  if (!tripPoiId) throw new AppError('DATA_VALIDATION', 'trip_poi ID 格式錯誤');

  const db = context.env.DB;

  const [hasPerm, belongsToTrip] = await Promise.all([
    hasWritePermission(db, auth.email, id, auth.isAdmin),
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

  // 2026-05-02 commit 11: split body into trip_pois fields vs pois master fields.
  // Master fields auto-dispatch to UPDATE pois — eliminates the silent no-op
  // pattern where caller PATCH /trip-pois with address/phone/etc was rejected
  // by the whitelist filter and buildUpdateClause returned empty.
  const masterFields: Record<string, unknown> = {};
  for (const k of POI_MASTER_ONLY_FIELDS) {
    if (k in body) masterFields[k] = body[k];
  }
  const hasMaster = Object.keys(masterFields).length > 0;

  // Apply master UPDATE first (if any) — uses oldRow.poi_id from trip_pois join.
  let masterResult: Record<string, unknown> | null = null;
  if (hasMaster) {
    const poiId = oldRow.poi_id as number | undefined;
    if (!poiId) throw new AppError('SYS_INTERNAL', 'trip_poi 缺少 poi_id link');
    const oldPoi = await db.prepare('SELECT * FROM pois WHERE id = ?').bind(poiId).first<Record<string, unknown>>();
    if (!oldPoi) throw new AppError('DATA_NOT_FOUND', `master pois#${poiId} 不存在`);
    const masterClause = buildUpdateClause(masterFields, POI_MASTER_ONLY_FIELDS as unknown as string[]);
    if (masterClause) {
      masterResult = await db
        .prepare(`UPDATE pois SET ${masterClause.setClauses} WHERE id = ? RETURNING *`)
        .bind(...masterClause.values, poiId)
        .first<Record<string, unknown>>();
      await logAudit(db, {
        tripId: id, tableName: 'pois', recordId: poiId,
        action: 'update', changedBy: auth.email,
        diffJson: computeDiff(oldPoi, masterResult ?? {}),
      });
    }
  }

  const updateResult = buildUpdateClause(body, ALLOWED_FIELDS as unknown as string[]);
  let newRow: Record<string, unknown> | null = null;
  if (updateResult) {
    newRow = await db
      .prepare(`UPDATE trip_pois SET ${updateResult.setClauses} WHERE id = ? RETURNING *`)
      .bind(...updateResult.values, tripPoiId)
      .first<Record<string, unknown>>();
    if (!newRow) throw new AppError('SYS_INTERNAL', 'UPDATE RETURNING 未回傳資料');
    await logAudit(db, {
      tripId: id, tableName: 'trip_pois', recordId: tripPoiId,
      action: 'update', changedBy: auth.email,
      diffJson: computeDiff(oldRow, newRow),
    });
  } else if (!hasMaster) {
    // No trip_pois fields AND no master fields → nothing to update
    const rejected = Object.keys(body).filter(
      (k) => !(ALLOWED_FIELDS as readonly string[]).includes(k)
        && !(POI_MASTER_ONLY_FIELDS as readonly string[]).includes(k),
    );
    throw new AppError('DATA_VALIDATION', `無有效欄位可更新（收到: ${rejected.join(', ') || 'empty body'}）`);
  }

  return json({
    trip_poi: newRow ?? oldRow,
    ...(masterResult ? { poi: masterResult } : {}),
  });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, tpid } = context.params as { id: string; tpid: string };
  const tripPoiId = parseIntParam(tpid);
  if (!tripPoiId) throw new AppError('DATA_VALIDATION', 'trip_poi ID 格式錯誤');

  const db = context.env.DB;

  const [hasPerm, belongsToTrip] = await Promise.all([
    hasWritePermission(db, auth.email, id, auth.isAdmin),
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
