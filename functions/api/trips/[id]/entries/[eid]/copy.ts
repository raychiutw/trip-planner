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
 *   5. SELECT trip_entry_pois WHERE entry_id = source → INSERT canonical POI copies
 *   6. logAudit action='create' with diff source ref
 *   7. Return new entry row
 */

import { logAudit } from '../../../../_audit';
import { hasWritePermission, verifyEntryBelongsToTrip } from '../../../../_auth';
import { AppError } from '../../../../_errors';
import { parseTime } from '../../../../_time';
import { json, getAuth, parseJsonBody, parseIntParam } from '../../../../_utils';
import type { Env } from '../../../../_types';

interface CopyEntryBody {
  targetDayId: number;
  sortOrder?: number;
  time?: string | null;
}

interface SourceEntryPoi {
  poi_id: number;
  sort_order: number;
  description: string | null;
  note: string | null;
  reservation: string | null;
  reservation_url: string | null;
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
    hasWritePermission(db, auth, id, auth.isAdmin),
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

  const sourceStopPois = (await db
    .prepare(
      `SELECT poi_id, sort_order, description, note, reservation, reservation_url
       FROM trip_entry_pois
       WHERE entry_id = ?
       ORDER BY sort_order ASC`,
    )
    .bind(eid)
    .all<SourceEntryPoi>()).results ?? [];
  const copiedMasterPoiId = sourceStopPois.find((row) => row.sort_order === 1)?.poi_id ?? null;

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
  // v2.26.0 (migration 0056): 同步寫 start_time/end_time。若 body.time 覆寫，
  // 用 _time.ts parseTime 解析；否則 copy source 的 start_time/end_time。
  let copyStartTime: string | null;
  let copyEndTime: string | null;
  if (body.time !== undefined) {
    const parsed = parseTime(typeof body.time === 'string' ? body.time : null);
    copyStartTime = parsed.start;
    copyEndTime = parsed.end;
  } else {
    copyStartTime = (source.start_time as string | null) ?? null;
    copyEndTime = (source.end_time as string | null) ?? null;
  }

  // INSERT new entry — copy 所有 source 欄位除了 id、day_id、sort_order
  let newRow;
  try {
    newRow = await db
      .prepare(
        `INSERT INTO trip_entries
          (day_id, sort_order, time, start_time, end_time, title, description, source, note, travel_type, travel_desc, travel_min, poi_id, entry_pois_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`,
      )
      .bind(
        targetDayId,
        sortOrder,
        overrideTime,
        copyStartTime,
        copyEndTime,
        source.title,
        source.description,
        source.source,
        source.note,
        source.travel_type,
        source.travel_desc,
        source.travel_min,
        copiedMasterPoiId,
        sourceStopPois.length > 0 ? 1 : 0,
      )
      .first() as Record<string, unknown> | null;
  } catch (err) {
    console.error('[copy.ts] INSERT trip_entries failed', { eid, targetDayId, err });
    throw new AppError('SYS_DB_ERROR', 'DB 暫時無法處理，請稍後重試');
  }
  if (!newRow) throw new AppError('DATA_SAVE_FAILED', '複製 entry 失敗');

  const newEid = newRow.id as number;

  if (sourceStopPois.length > 0) {
    const now = new Date().toISOString();
    await db.batch(sourceStopPois.map((row) =>
      db
        .prepare(
          `INSERT INTO trip_entry_pois
             (entry_id, poi_id, sort_order, description, note, reservation, reservation_url, added_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newEid,
          row.poi_id,
          row.sort_order,
          row.description,
          row.note,
          row.reservation,
          row.reservation_url,
          now,
          now,
        ),
    ));
  }

  // Contextual trip_pois (hotel/shopping) are not copied by this endpoint; entry
  // stop choices are copied from trip_entry_pois above.

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
