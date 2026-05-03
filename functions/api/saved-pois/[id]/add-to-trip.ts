/**
 * POST /api/saved-pois/:id/add-to-trip — Fast-path REST endpoint (D-C1)
 *
 * 從「我的收藏」直接加入指定 trip / day / position，立即建立 trip_entries + trip_pois。
 * 不走 message-based tp-request 避免 LLM 8 秒等待感（autoplan Design phase critical fix）。
 *
 * Body:
 *   tripId         必填 — 目標 trip
 *   dayNum         必填 — 哪一天 (1-based)
 *   position       選填 — 'append' (預設) | 'before' | 'after' | 'replace'
 *   anchorEntryId  必填當 position 為 before/after/replace
 *   startTime      選填 — 'HH:MM' 格式，預設依 POI type 推 (heuristic 同 tp-request)
 *   endTime        選填 — 'HH:MM' 格式，預設 startTime + duration heuristic
 *
 * Travel computation: 此 endpoint 不算 travel_*，欄位設 NULL（前端顯示「計算車程中…」placeholder）。
 * 後續 tp-request 任一執行會 fill travel 欄位（既有 pipeline）。
 *
 * Auth: 需 saved_pois owner OR admin + 對 tripId 有 hasWritePermission。
 */
import { logAudit } from '../../_audit';
import { hasWritePermission } from '../../_auth';
import { AppError } from '../../_errors';
import { requireAuth } from '../../_auth';
import { json, parseIntParam, parseJsonBody } from '../../_utils';
import type { Env } from '../../_types';

interface Body {
  tripId?: string;
  dayNum?: number;
  position?: 'append' | 'before' | 'after' | 'replace';
  anchorEntryId?: number;
  startTime?: string;
  endTime?: string;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Stay duration heuristic (DX-C4 sharing with tp-request) — minutes by POI type */
const STAY_MINUTES: Record<string, number> = {
  hotel: 0, // overnight, handled differently
  restaurant: 90,
  shopping: 60,
  attraction: 120,
  parking: 15,
  transport: 30,
  activity: 90,
  other: 60,
};

function defaultStartFor(type: string): string {
  // crude defaults — restaurant 12:00 lunch, attraction 10:00 morning, etc.
  if (type === 'restaurant') return '12:00';
  if (type === 'shopping') return '14:00';
  if (type === 'hotel') return '15:00';
  return '10:00';
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export const onRequestPost: PagesFunction<Env, 'id'> = async (context) => {
  const auth = requireAuth(context);
  const savedPoiId = parseIntParam(context.params.id as string);
  if (!savedPoiId) throw new AppError('DATA_VALIDATION', 'savedPoiId 須為正整數');

  const body = await parseJsonBody<Body>(context.request);
  const { tripId, dayNum, position = 'append', anchorEntryId, startTime, endTime } = body;
  if (!tripId) throw new AppError('DATA_VALIDATION', '缺少 tripId');
  if (!Number.isInteger(dayNum) || (dayNum as number) < 1) {
    throw new AppError('DATA_VALIDATION', 'dayNum 須為 ≥1 的整數');
  }
  if (!['append', 'before', 'after', 'replace'].includes(position)) {
    throw new AppError('DATA_VALIDATION', 'position 必須為 append / before / after / replace');
  }
  if (position !== 'append' && !anchorEntryId) {
    throw new AppError('DATA_VALIDATION', `position=${position} 需 anchorEntryId`);
  }
  if (startTime !== undefined && !TIME_RE.test(startTime)) {
    throw new AppError('DATA_VALIDATION', 'startTime 須為 HH:MM 格式');
  }
  if (endTime !== undefined && !TIME_RE.test(endTime)) {
    throw new AppError('DATA_VALIDATION', 'endTime 須為 HH:MM 格式');
  }

  const db = context.env.DB;

  // 1. saved_pois ownership check (V2 cutover phase 2: 純 user_id)
  const saved = await db
    .prepare(
      `SELECT sp.id, sp.user_id, sp.poi_id, sp.note,
              p.name AS poi_name, p.type AS poi_type
       FROM saved_pois sp
       JOIN pois p ON p.id = sp.poi_id
       WHERE sp.id = ?`,
    )
    .bind(savedPoiId)
    .first<{
      id: number;
      user_id: string | null;
      poi_id: number;
      note: string | null;
      poi_name: string;
      poi_type: string;
    }>();
  if (!saved) throw new AppError('DATA_NOT_FOUND', '找不到該收藏');
  const ownByUid = auth.userId !== null && saved.user_id === auth.userId;
  if (!ownByUid && !auth.isAdmin) {
    throw new AppError('PERM_DENIED', '只能加入自己的收藏');
  }

  // 2. Trip write permission (M2 security boundary — companion scope binds writes to caller, not owner)
  if (!(await hasWritePermission(db, auth, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  // 3. Day exists
  const day = await db
    .prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = ?')
    .bind(tripId, dayNum)
    .first<{ id: number }>();
  if (!day) throw new AppError('DATA_NOT_FOUND', `Day ${dayNum} 不存在`);

  // 4. anchor entry validation
  let anchorSortOrder: number | null = null;
  if (anchorEntryId !== undefined) {
    const anchor = await db
      .prepare('SELECT id, day_id, sort_order FROM trip_entries WHERE id = ? AND day_id = ?')
      .bind(anchorEntryId, day.id)
      .first<{ id: number; day_id: number; sort_order: number }>();
    if (!anchor) throw new AppError('DATA_NOT_FOUND', 'anchorEntryId 不在該天');
    anchorSortOrder = anchor.sort_order;
  }

  // 5. Determine sort_order
  let sortOrder: number;
  const stmts: D1PreparedStatement[] = [];
  if (position === 'append') {
    const max = await db
      .prepare('SELECT MAX(sort_order) AS max_sort FROM trip_entries WHERE day_id = ?')
      .bind(day.id)
      .first<{ max_sort: number | null }>();
    sortOrder = (max?.max_sort ?? -1) + 1;
  } else if (position === 'before') {
    sortOrder = anchorSortOrder!;
    // shift anchor + 後面的 sort_order +1 騰位
    stmts.push(
      db.prepare('UPDATE trip_entries SET sort_order = sort_order + 1 WHERE day_id = ? AND sort_order >= ?')
        .bind(day.id, sortOrder),
    );
  } else if (position === 'after') {
    sortOrder = anchorSortOrder! + 1;
    stmts.push(
      db.prepare('UPDATE trip_entries SET sort_order = sort_order + 1 WHERE day_id = ? AND sort_order >= ?')
        .bind(day.id, sortOrder),
    );
  } else {
    // replace
    sortOrder = anchorSortOrder!;
    stmts.push(
      db.prepare('DELETE FROM trip_entries WHERE id = ?').bind(anchorEntryId!),
    );
  }

  // 6. Compute time defaults if not provided
  const start = startTime ?? defaultStartFor(saved.poi_type);
  const stayMins = STAY_MINUTES[saved.poi_type] ?? 60;
  const end = endTime ?? addMinutes(start, stayMins);

  // 7. INSERT trip_entries (travel_* NULL — async fill via tp-request)
  stmts.push(
    db.prepare(
      `INSERT INTO trip_entries (day_id, sort_order, time, title, description, source, note, poi_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      day.id,
      sortOrder,
      `${start}-${end}`,
      saved.poi_name,
      null,
      'fast-path',
      saved.note,
      saved.poi_id,
    ),
  );

  await db.batch(stmts);

  // INSERT 完讀回新 entry id
  const created = await db
    .prepare('SELECT id FROM trip_entries WHERE day_id = ? AND sort_order = ? AND poi_id = ? ORDER BY id DESC LIMIT 1')
    .bind(day.id, sortOrder, saved.poi_id)
    .first<{ id: number }>();
  const newEntryId = created?.id ?? null;

  // 8. trip_pois link (per-trip POI metadata)
  if (newEntryId !== null) {
    await db
      .prepare(
        `INSERT INTO trip_pois (trip_id, poi_id, context, day_id, entry_id, source)
         VALUES (?, ?, 'timeline', ?, ?, 'fast-path')`,
      )
      .bind(tripId, saved.poi_id, day.id, newEntryId)
      .run();
  }

  // 9. Audit log
  await logAudit(db, {
    tripId,
    tableName: 'trip_entries',
    recordId: newEntryId,
    action: 'insert',
    changedBy: auth.email,
    diffJson: JSON.stringify({
      via: 'saved-pois-fast-path',
      savedPoiId,
      poiId: saved.poi_id,
      dayNum,
      position,
      anchorEntryId,
      startTime: start,
      endTime: end,
    }),
  });

  return json({
    ok: true,
    entryId: newEntryId,
    dayId: day.id,
    sortOrder,
    startTime: start,
    endTime: end,
    note: 'travel_* 欄位將由背景 tp-request 計算填入',
  }, 201);
};
