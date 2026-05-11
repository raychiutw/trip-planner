/**
 * PATCH /api/trips/:id/entries/:eid/master — 設定/變更 entry 的 master POI
 *
 * v2.27.0 multi-POI per entry 的核心 mutating endpoint。Body:
 *   - poiId: number    — 新 master POI id（可為現有 alternate 或全新 POI）
 *   - version?: string — OCC 樂觀並發 token（從 GET response 取，省略則 skip check）
 *
 * 行為（per design doc + Codex Finding #1, #2, #3）：
 *   - poiId 是現有 alternate → swap sort_order（master 降為 alternate）
 *   - poiId 是新 POI → 既有 master 推到 max+1, INSERT 新 master sort_order=1
 *   - 同步 dual-write trip_entries.poi_id
 *   - 同 TX mark from/to segments stale
 *   - 失敗 throw AppError；STALE_ENTRY 409 表示 version mismatch（client 該 refetch）
 *
 * Note: actual Google Routes recompute 不在這 endpoint 內觸發（segments PATCH /trip/:id/segments/:sid
 * 透過 source='stale' detect 後自動 recompute；簡化 v2.27.0 scope）。
 */
import { hasWritePermission, verifyEntryBelongsToTrip } from '../../../../_auth';
import { AppError } from '../../../../_errors';
import { setMaster } from '../../../../_entry_pois';
import { json, getAuth, parseJsonBody, parseIntParam } from '../../../../_utils';
import type { Env } from '../../../../_types';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, eid: eidStr } = context.params as { id: string; eid: string };
  const eid = parseIntParam(eidStr);
  if (!eid) throw new AppError('DATA_VALIDATION', 'entry ID 格式錯誤');
  const db = context.env.DB;

  const [canWrite, belongsToTrip] = await Promise.all([
    hasWritePermission(db, auth, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, eid, id),
  ]);
  if (!canWrite) throw new AppError('PERM_DENIED');
  if (!belongsToTrip) throw new AppError('DATA_NOT_FOUND');

  const body = await parseJsonBody<{ poiId?: number; version?: string }>(context.request);
  if (typeof body.poiId !== 'number' || !Number.isInteger(body.poiId) || body.poiId <= 0) {
    throw new AppError('DATA_VALIDATION', 'poiId 必須是 positive integer');
  }

  // 確認 POI 存在
  const poiExists = await db
    .prepare('SELECT id FROM pois WHERE id = ?')
    .bind(body.poiId)
    .first();
  if (!poiExists) throw new AppError('DATA_NOT_FOUND', `POI ${body.poiId} 不存在`);

  const result = await setMaster(db, eid, body.poiId, body.version);

  return json({
    entryId: eid,
    masterPoiId: body.poiId,
    oldMasterPoiId: result.oldMasterPoiId,
    entryPoisVersion: result.version,
  });
};
