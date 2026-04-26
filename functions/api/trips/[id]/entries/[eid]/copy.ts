/**
 * POST /api/trips/:id/entries/:eid/copy
 *
 * v2.10 Wave 1 Item 2 — 複製 entry 到目標 day。對應 V3 mockup ⎘ button +
 * EntryActionPopover(action='copy')。
 *
 * Body:
 *   {
 *     targetDayId: number,    // 必填，必須屬於同 trip
 *     sortOrder?: number,     // 選填，預設追加到目標 day 末尾
 *     time?: string | null,   // 選填，覆寫 source.time
 *   }
 *
 * Logic:
 *   1. perm check + verifyEntryBelongsToTrip
 *   2. SELECT source entry
 *   3. validate targetDayId 屬於同 trip
 *   4. INSERT new entry with day_id = targetDayId, sort_order, 其他欄位 copy
 *   5. SELECT trip_pois WHERE entry_id = source → INSERT 副本 with entry_id = new
 *   6. logAudit action='create' with diff source ref
 *   7. Return new entry row
 */

import { logAudit } from '../../../../_audit';
import { hasPermission, verifyEntryBelongsToTrip } from '../../../../_auth';
import { AppError } from '../../../../_errors';
import { json, getAuth, parseJsonBody, parseIntParam } from '../../../../_utils';
import type { Env } from '../../../../_types';

interface CopyEntryBody {
  targetDayId: number;
  sortOrder?: number;
  time?: string | null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, eid: eidStr } = context.params as { id: string; eid: string };
  const eid = parseIntParam(eidStr);
  if (!eid) throw new AppError('DATA_VALIDATION', 'ID 格式錯誤');
  const db = context.env.DB;
  const changedBy = auth.email;

  const [hasPerm, belongsToTrip] = await Promise.all([
    hasPermission(db, auth.email, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, eid, id),
  ]);
  if (!hasPerm) throw new AppError('PERM_DENIED');
  if (!belongsToTrip) throw new AppError('DATA_NOT_FOUND');

  const body = await parseJsonBody<Partial<CopyEntryBody>>(context.request);
  const targetDayId = body.targetDayId;
  if (typeof targetDayId !== 'number' || !Number.isInteger(targetDayId) || targetDayId <= 0) {
    throw new AppError('DATA_VALIDATION', 'targetDayId 必須是正整數');
  }

  // 驗證 targetDay 屬於同 trip（防越權 copy 到別 trip）
  const targetDay = await db
    .prepare('SELECT trip_id FROM trip_days WHERE id = ?')
    .bind(targetDayId)
    .first() as { trip_id: string } | null;
  if (!targetDay) throw new AppError('DATA_NOT_FOUND', '指定的 day 不存在');
  if (targetDay.trip_id !== id) throw new AppError('PERM_DENIED', '不可將 entry 複製到其他 trip');

  // SELECT source entry（已驗證 belongsToTrip）
  const source = await db
    .prepare('SELECT * FROM trip_entries WHERE id = ?')
    .bind(eid)
    .first() as Record<string, unknown> | null;
  if (!source) throw new AppError('DATA_NOT_FOUND');

  // sortOrder 預設追加到目標 day 末尾
  let sortOrder = body.sortOrder;
  if (typeof sortOrder !== 'number') {
    const maxRow = await db
      .prepare('SELECT MAX(sort_order) as maxSort FROM trip_entries WHERE day_id = ?')
      .bind(targetDayId)
      .first() as { maxSort: number | null } | null;
    sortOrder = (maxRow?.maxSort ?? -1) + 1;
  }

  const overrideTime = body.time !== undefined ? body.time : source.time;

  // INSERT new entry — copy 所有 source 欄位除了 id、day_id、sort_order
  let newRow;
  try {
    newRow = await db
      .prepare(
        `INSERT INTO trip_entries
          (day_id, sort_order, time, title, description, source, note, travel_type, travel_desc, travel_min, poi_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`,
      )
      .bind(
        targetDayId,
        sortOrder,
        overrideTime,
        source.title,
        source.description,
        source.source,
        source.note,
        source.travel_type,
        source.travel_desc,
        source.travel_min,
        source.poi_id,
      )
      .first() as Record<string, unknown> | null;
  } catch {
    throw new AppError('SYS_DB_ERROR', 'DB 暫時無法處理，請稍後重試');
  }
  if (!newRow) throw new AppError('DATA_SAVE_FAILED', '複製 entry 失敗');

  const newEid = newRow.id as number;

  // 註：v2.10 Wave 1 不複製 trip_pois 關聯。entries 多半透過 entries.poi_id
  // 連 master POI（已在 INSERT 上面 source.poi_id 帶過去），trip_pois 主要是
  // hotel 場景或 user 覆寫 master POI 的場合，冷門。需要時可在 follow-up PR
  // 補 cloneTripPois 邏輯（要對齊 trip_pois 完整 schema 含 description/note/
  // hours/checkout/breakfast_*/price/reservation/must_buy）。

  await logAudit(db, {
    tripId: id,
    tableName: 'trip_entries',
    recordId: newEid,
    action: 'insert',
    changedBy,
    diffJson: JSON.stringify({ copiedFromEntryId: eid, targetDayId, sortOrder }),
  });

  return json(newRow);
};
