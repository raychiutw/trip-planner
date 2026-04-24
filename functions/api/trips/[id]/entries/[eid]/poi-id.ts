/**
 * PUT /api/trips/:id/entries/:eid/poi-id — 重掛 entry 的 poi_id
 *
 * 為什麼是獨立端點：PATCH /entries/:eid 把 poi_id 從 ALLOWED_FIELDS 拿掉避免
 * 任何編輯者改指任意 POI（跨 trip 資料外洩 / FK 違反）。這條路徑提供安全的
 * 重掛能力：驗證 POI 存在、驗證 entry 屬於這個 trip、記錄稽核。
 *
 * Body: { poi_id: number | null }
 *   - 數字：指向 pois.id；須先驗證 POI 存在
 *   - null：清空 poi_id（entry 變成無 POI master 狀態）
 */

import { logAudit } from '../../../../_audit';
import { hasPermission, verifyEntryBelongsToTrip } from '../../../../_auth';
import { AppError } from '../../../../_errors';
import { json, getAuth, parseJsonBody, parseIntParam } from '../../../../_utils';
import type { Env } from '../../../../_types';

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, eid } = context.params as { id: string; eid: string };
  const entryId = parseIntParam(eid);
  if (!entryId) throw new AppError('DATA_VALIDATION', 'entry ID 格式錯誤');
  const db = context.env.DB;

  const [hasPerm, belongsToTrip] = await Promise.all([
    hasPermission(db, auth.email, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, entryId, id),
  ]);
  if (!hasPerm) throw new AppError('PERM_DENIED');
  if (!belongsToTrip) throw new AppError('PERM_DENIED', '此 entry 不屬於該行程');

  const body = await parseJsonBody<{ poi_id?: number | null }>(context.request);
  if (!('poi_id' in body)) throw new AppError('DATA_VALIDATION', '缺少 poi_id');

  const newPoiId = body.poi_id;
  if (newPoiId !== null && (typeof newPoiId !== 'number' || !Number.isInteger(newPoiId) || newPoiId <= 0)) {
    throw new AppError('DATA_VALIDATION', 'poi_id 須為正整數或 null');
  }

  // Verify POI exists（null 直接略過）
  if (newPoiId !== null) {
    const poi = await db.prepare('SELECT id FROM pois WHERE id = ?').bind(newPoiId).first();
    if (!poi) throw new AppError('DATA_NOT_FOUND', `pois.id=${newPoiId} 不存在`);
  }

  const oldRow = await db.prepare('SELECT poi_id FROM trip_entries WHERE id = ?').bind(entryId).first() as { poi_id: number | null } | null;
  if (!oldRow) throw new AppError('DATA_NOT_FOUND', '找不到 entry');

  await db.prepare('UPDATE trip_entries SET poi_id = ? WHERE id = ?').bind(newPoiId, entryId).run();

  await logAudit(db, {
    tripId: id,
    tableName: 'trip_entries',
    recordId: entryId,
    action: 'update',
    changedBy: auth.email,
    diffJson: JSON.stringify({ poi_id: { old: oldRow.poi_id, new: newPoiId } }),
  });

  return json({ ok: true, poi_id: newPoiId });
};
