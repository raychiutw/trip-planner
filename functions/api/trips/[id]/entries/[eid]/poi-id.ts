/**
 * PUT /api/trips/:id/entries/:eid/poi-id — 重掛 entry 的 poi_id
 *
 * 為什麼是獨立端點：PATCH /entries/:eid 把 poi_id 從 ALLOWED_FIELDS 拿掉避免
 * 任何編輯者改指任意 POI（跨 trip 資料外洩 / FK 違反）。這條路徑提供安全的
 * 重掛能力：驗證 POI 存在、驗證 entry 屬於這個 trip、記錄稽核。
 *
 * Body 兩種 mode（v2.23.8）：
 *   1. { poi_id: number | null } — 直接重掛到既有 POI 或清空
 *   2. { name: string, lat: number, lng: number, source?: string } — 從 search 結果
 *      新建 POI（find-or-create by lat/lng）並重掛。entry.title 也同步更新為 name。
 *
 * round 7 fix + round 9 cleanup: 接受可選 OCC token `entryPoisVersion` 對齊其他
 * multi-POI endpoints（PATCH /master / POST,DELETE /alternates / PATCH /alternates/reorder
 * 統一 camelCase）。若 client 帶上，setMaster 走 expectedVersion check；mismatch →
 * 409 STALE_ENTRY。沒帶仍向後相容 — UNIQUE constraint 仍能 catch true race，但 cross-tab
 * lost-update 場景需 client 帶 token 才能 detect（adversarial round 6 #2）。
 *
 * Round 8 contract specialist P2：拿掉 round 7 引入的 snake_case 別名（`entry_pois_version`），
 * 統一 camelCase。CHANGELOG 列為 round 9 cleanup — 沒 production client 用過 snake form。
 */

import { findOrCreatePoi } from '../../../../_poi';
import { logAudit } from '../../../../_audit';
import { hasWritePermission, verifyEntryBelongsToTrip } from '../../../../_auth';
import { AppError } from '../../../../_errors';
import { setMaster } from '../../../../_entry_pois';
import { json, getAuth, parseJsonBody, parseIntParam } from '../../../../_utils';
import type { Env } from '../../../../_types';

interface ChangePoiBody {
  poi_id?: number | null;
  // direct-from-search mode
  name?: string;
  lat?: number;
  lng?: number;
  source?: string;
  // round 7 + round 9: OCC token (optional, camelCase only — matches other multi-POI endpoints)
  entryPoisVersion?: string;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, eid } = context.params as { id: string; eid: string };
  const entryId = parseIntParam(eid);
  if (!entryId) throw new AppError('DATA_VALIDATION', 'entry ID 格式錯誤');
  const db = context.env.DB;

  const [hasPerm, belongsToTrip] = await Promise.all([
    hasWritePermission(db, auth, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, entryId, id),
  ]);
  if (!hasPerm) throw new AppError('PERM_DENIED');
  if (!belongsToTrip) throw new AppError('PERM_DENIED', '此 entry 不屬於該行程');

  const body = await parseJsonBody<ChangePoiBody>(context.request);

  // Resolve mode：poi_id mode (existing) vs find-or-create mode (new from search)
  let newPoiId: number | null;
  let newTitle: string | null = null;
  if ('poi_id' in body) {
    newPoiId = body.poi_id ?? null;
    if (newPoiId !== null && (typeof newPoiId !== 'number' || !Number.isInteger(newPoiId) || newPoiId <= 0)) {
      throw new AppError('DATA_VALIDATION', 'poi_id 須為正整數或 null');
    }
    if (newPoiId !== null) {
      const poi = await db.prepare('SELECT id FROM pois WHERE id = ?').bind(newPoiId).first();
      if (!poi) throw new AppError('DATA_NOT_FOUND', `pois.id=${newPoiId} 不存在`);
    }
  } else if (body.name && typeof body.lat === 'number' && typeof body.lng === 'number') {
    // find-or-create from search payload
    newPoiId = await findOrCreatePoi(db, {
      name: body.name,
      type: 'attraction',
      lat: body.lat,
      lng: body.lng,
      source: body.source ?? 'google',
    });
    newTitle = body.name;
  } else {
    throw new AppError('DATA_VALIDATION', '須提供 poi_id 或 { name, lat, lng }');
  }

  const oldRow = await db.prepare('SELECT poi_id FROM trip_entries WHERE id = ?').bind(entryId).first() as { poi_id: number | null } | null;
  if (!oldRow) throw new AppError('DATA_NOT_FOUND', '找不到 entry');

  // v2.27.0：透過 setMaster() 同步維護 trip_entry_pois.sort_order=1（含 entries.poi_id
  // dual-write + segments stale marking）。
  //
  // newPoiId === null 路徑在 v2.27.0 invariant「每 entry 至少 1 master POI」下 illegal：
  // 清空 master 要走 DELETE /entries/:eid 刪整個 entry。pre v2.27.0 此分支事實上 unreachable
  // （frontend 沒地方傳 null）；為避免 silently 留下 trip_entry_pois orphan row + entries.poi_id
  // 跟 trip_entry_pois.sort_order=1 dual-source 不一致，這裡 explicit 阻擋（Codex pre-landing
  // HIGH #4）。
  if (newPoiId === null) {
    throw new AppError(
      'DATA_VALIDATION',
      'v2.27.0 不允許清空 master POI；要刪除請走 DELETE /entries/:eid',
    );
  }

  // round 7 fix: pass OCC token through to setMaster (adversarial #2 — was bypassed).
  await setMaster(db, entryId, newPoiId, body.entryPoisVersion);
  if (newTitle !== null) {
    await db.prepare('UPDATE trip_entries SET title = ? WHERE id = ?')
      .bind(newTitle, entryId).run();
  }

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
