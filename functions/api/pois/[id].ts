/**
 * PATCH /api/pois/:id — 修改 master POI (C2)
 * DELETE /api/pois/:id — 刪除 master POI（admin only，會先刪除所有關聯 trip_pois）
 *
 * Admin: 可不帶 tripId（向下相容 tp-patch/tp-rebuild）
 * 非 Admin: 必須帶 tripId，檢查 hasPermission + POI 屬於該 trip
 */

import { logAudit, computeDiff } from '../_audit';
import { hasPermission } from '../_auth';
import { AppError } from '../_errors';
import { json, getAuth, parseJsonBody, buildUpdateClause, parseIntParam } from '../_utils';
import type { Env } from '../_types';

const ALLOWED_FIELDS = [
  'name', 'description', 'note', 'address', 'phone', 'email', 'website',
  'hours', 'google_rating', 'category', 'maps', 'mapcode', 'lat', 'lng',
  'country', 'source',
] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const poiId = parseIntParam(context.params.id as string);
  if (!poiId) throw new AppError('DATA_VALIDATION', 'POI ID 格式錯誤');

  const db = context.env.DB;
  const body = await parseJsonBody<Record<string, unknown>>(context.request);

  // --- 權限檢查 ---
  const tripId = body.tripId as string | undefined;
  delete body.tripId; // tripId 不是 POI 欄位，從 update payload 移除

  const oldRow = await db.prepare('SELECT * FROM pois WHERE id = ?').bind(poiId).first();
  if (!oldRow) throw new AppError('DATA_NOT_FOUND', '找不到此 POI');

  if (!auth.isAdmin) {
    if (!tripId) throw new AppError('DATA_VALIDATION', '非 admin 必須提供 tripId');
    if (!await hasPermission(db, auth.email, tripId, false)) {
      throw new AppError('PERM_DENIED');
    }
    const link = await db.prepare(
      'SELECT 1 FROM trip_pois WHERE poi_id = ? AND trip_id = ?'
    ).bind(poiId, tripId).first();
    if (!link) throw new AppError('PERM_DENIED', '此 POI 不屬於該行程');
  }

  const update = buildUpdateClause(body, ALLOWED_FIELDS as unknown as string[]);
  if (!update) throw new AppError('DATA_VALIDATION', '無有效欄位可更新');

  const newRow = await db.prepare(`UPDATE pois SET ${update.setClauses} WHERE id = ? RETURNING *`)
    .bind(...update.values, poiId).first();
  if (!newRow) throw new AppError('SYS_INTERNAL', 'UPDATE RETURNING 未回傳資料');
  const diffJson = computeDiff(oldRow as Record<string, unknown>, newRow as Record<string, unknown>);

  await logAudit(db, {
    tripId: tripId || 'global',
    tableName: 'pois',
    recordId: poiId,
    action: 'update',
    changedBy: auth.email,
    diffJson,
  });

  return json(newRow);
};

/**
 * DELETE /api/pois/:id — 刪除 master POI + 所有關聯 trip_pois
 * Admin only（Service Token 視為 admin）
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');
  if (!auth.isAdmin) throw new AppError('PERM_DENIED', '僅 admin 可刪除 master POI');

  const poiId = parseIntParam(context.params.id as string);
  if (!poiId) throw new AppError('DATA_VALIDATION', 'POI ID 格式錯誤');

  const db = context.env.DB;

  const oldRow = await db.prepare('SELECT * FROM pois WHERE id = ?').bind(poiId).first();
  if (!oldRow) throw new AppError('DATA_NOT_FOUND', '找不到此 POI');

  // 先刪除所有關聯的 trip_pois
  const relatedTripPois = await db.prepare(
    'SELECT id, trip_id FROM trip_pois WHERE poi_id = ?'
  ).bind(poiId).all<{ id: number; trip_id: string }>();

  if (relatedTripPois.results.length > 0) {
    await db.prepare('DELETE FROM trip_pois WHERE poi_id = ?').bind(poiId).run();
  }

  // Phase 2：trip_entries.poi_id FK 沒 ON DELETE SET NULL，手動清空，否則 DELETE pois 會 FK fail
  await db.prepare('UPDATE trip_entries SET poi_id = NULL WHERE poi_id = ?').bind(poiId).run();

  // 刪除 pois master
  await db.prepare('DELETE FROM pois WHERE id = ?').bind(poiId).run();

  await logAudit(db, {
    tripId: 'global',
    tableName: 'pois',
    recordId: poiId,
    action: 'delete',
    changedBy: auth.email,
    snapshot: JSON.stringify(oldRow),
  });

  return json({
    ok: true,
    deleted_trip_pois: relatedTripPois.results.length,
  });
};
