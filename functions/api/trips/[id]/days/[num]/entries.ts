import { logAudit } from '../../../../_audit';
import { hasWritePermission, requireAuth} from '../../../../_auth';
import { AppError } from '../../../../_errors';
import { findOrCreatePoi } from '../../../../_poi';
import { syncEntryMaster } from '../../../../_entry_pois';
import { resolveEntryTimes } from '../../../../_time';
import { resortDayByArrival } from '../../../../_entry_sort';
import { validateEntryBody, detectGarbledText } from '../../../../_validate';
import { json, parseJsonBody } from '../../../../_utils';
import type { Env } from '../../../../_types';

/**
 * POST /api/trips/:id/days/:num/entries — 新增 entry 到指定天
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);

  const { id, num } = context.params as { id: string; num: string };
  const dayNum = Number(num);
  if (!Number.isInteger(dayNum) || dayNum < 1) {
    throw new AppError('DATA_VALIDATION', 'day_num 格式錯誤');
  }

  const db = context.env.DB;
  const changedBy = auth.email;

  if (!await hasWritePermission(db, auth, id)) {
    throw new AppError('PERM_DENIED');
  }

  const day = await db
    .prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = ?')
    .bind(id, dayNum)
    .first() as { id: number } | null;

  if (!day) throw new AppError('DATA_NOT_FOUND');
  const dayId = day.id;

  const body = await parseJsonBody<Record<string, unknown>>(context.request);

  const validation = validateEntryBody(body);
  if (!validation.ok) throw new AppError('DATA_VALIDATION', validation.error);

  // 亂碼偵測
  for (const f of ['name', 'description', 'note']) {
    if (f in body && typeof body[f] === 'string' && detectGarbledText(body[f] as string)) {
      throw new AppError('DATA_ENCODING', `欄位 ${f} 包含疑似亂碼，請確認 encoding 為 UTF-8`);
    }
  }

  // Phase 2: poi_type 白名單（避免 pois.type CHECK 失敗）
  const ALLOWED_POI_TYPES = new Set(['hotel', 'restaurant', 'shopping', 'parking', 'attraction', 'transport', 'activity', 'other']);
  if (body.poi_type !== undefined && (typeof body.poi_type !== 'string' || !ALLOWED_POI_TYPES.has(body.poi_type))) {
    throw new AppError('DATA_VALIDATION', `poi_type 無效（允許：${[...ALLOWED_POI_TYPES].join(', ')}）`);
  }

  // sort_order：指定則用指定值，否則 append 到最後
  let sortOrder: number;
  if (typeof body.sort_order === 'number') {
    if (!Number.isInteger(body.sort_order) || body.sort_order < 0) {
      throw new AppError('DATA_VALIDATION', 'sort_order 必須為非負整數');
    }
    sortOrder = body.sort_order;
  } else {
    const max = await db
      .prepare('SELECT MAX(sort_order) as max_sort FROM trip_entries WHERE day_id = ?')
      .bind(dayId)
      .first() as { max_sort: number | null } | null;
    sortOrder = (max?.max_sort ?? -1) + 1;
  }

  // Phase 2：name 必須為非空白字串（validateEntryBody 只檢 falsiness，空白字串通過）
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new AppError('DATA_VALIDATION', 'name 不可為空白');

  // Phase 2：entry 對應的 pois master（find-or-create），再回填 poi_id
  // 包在 try/catch 內統一 error path；POI 建成後若 INSERT 失敗，orphan POI
  // 由後續 `migrate-entries-to-pois.js --clean-orphans` 清理。
  // poiId 宣告在 try 外因為 try 結束後還要拿去 syncEntryMaster (v2.27.0 multi-POI)。
  let row;
  let poiId: number | null = null;
  try {
    poiId = await findOrCreatePoi(db, {
      name,
      type: (body.poi_type as string) || 'attraction',
      description: (body.description as string | undefined) ?? null,
      lat: (body.lat as number | undefined) ?? null,
      lng: (body.lng as number | undefined) ?? null,
      rating: (body.rating as number | undefined) ?? null,
      // v2.31.94: forward body.source to pois.source as dedup/audit signal.
      // String-typed guard rejects accidental non-string values; falls back to
      // 'ai' for the existing search/favorite paths that don't supply source.
      source: (typeof body.source === 'string' && body.source) || 'ai',
    });

    // v2.29.0: trip_entries.{time, travel_*, poi_id} DROPPED. resolveEntryTimes 仍接受
    // legacy body.time → parse 拆 start/end，但 INSERT 只寫 start_time/end_time。
    // poi_id 改透過 trip_entry_pois 寫 master (sort_order=1，下方 helper)，不直接寫 col。
    const { startTime, endTime } = resolveEntryTimes(body);

    // migration 0078: trip_entries.note DROPPED — INSERT 不再帶 note；entry-level 備註
    // 改透過 syncEntryMaster 寫進新 master 的 per-POI note（下方）。
    row = await db
      .prepare(`INSERT INTO trip_entries (day_id, sort_order, start_time, end_time, description, source, entry_pois_version) VALUES (?, ?, ?, ?, ?, ?, 1) RETURNING *`)
      .bind(
        dayId, sortOrder,
        startTime,
        endTime,
        body.description ?? null,
        body.source ?? 'ai',
      )
      .first();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('SYS_DB_ERROR', 'DB 暫時無法處理，請稍後重試');
  }

  if (!row) throw new AppError('DATA_SAVE_FAILED', '新增 entry 失敗');

  // v2.27.0：同步 trip_entry_pois.sort_order=1（multi-POI per entry invariant）。
  // 若不寫此 helper，後續 addAlternate 會 fire MISSING_MASTER 直到第一次 GET 自我修復
  // (Codex pre-landing CRITICAL #2)。
  //
  // v2.33.55 round 5d residual: syncEntryMaster 失敗 → compensating DELETE。
  // D1 不支援 BEGIN/COMMIT cross-statement transaction，只能 best-effort 補救。
  // 否則 entry exists 但無 master，下次 GET self-heal 之前 addAlternate 會 MISSING_MASTER。
  // migration 0078: entry-level note → 新 master 的 per-POI note。trim 後空字串視為無備註。
  const masterNote =
    typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : null;
  const insertedEntryId = (row as { id?: unknown }).id;
  if (poiId != null && typeof insertedEntryId === 'number') {
    try {
      await syncEntryMaster(db, insertedEntryId, poiId, masterNote);
    } catch (err) {
      console.error('[entries POST] syncEntryMaster failed, compensating delete', { insertedEntryId, err });
      await db.prepare('DELETE FROM trip_entries WHERE id = ?').bind(insertedEntryId).run();
      throw new AppError('SYS_DB_ERROR', 'entry 建立失敗，請稍後重試');
    }
  }

  await logAudit(db, {
    tripId: id,
    tableName: 'trip_entries',
    recordId: (row as Record<string, unknown>).id as number,
    action: 'insert',
    changedBy,
    diffJson: JSON.stringify({ day_num: dayNum, poiName: name, sort_order: sortOrder }),
  });

  // 新增後依抵達時間重排當日：帶 start_time 的新景點會移到正確時序位置；無時間則殿後
  // （no-op）。AI 逐筆批建本就依序 → no-op 不寫入。travel 重算由前端流程觸發。
  // best-effort：entry 已 INSERT commit，重排失敗不可讓成功的建立回報 500（否則 client
  // 重試 → 重複 entry）；resort 自癒。
  try {
    await resortDayByArrival(db, dayId);
  } catch (err) {
    console.error('[entries POST] resortDayByArrival failed (non-fatal)', err);
  }

  return json(row, 201);
};
