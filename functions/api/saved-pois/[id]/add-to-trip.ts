/**
 * POST /api/saved-pois/:id/add-to-trip — fast-path REST 從「我的收藏」加入指定 trip。
 *
 * Body: { tripId, dayNum, position?, anchorEntryId?, startTime?, endTime? }
 * Auth: saved_pois owner OR admin + 對 tripId 有 hasWritePermission。
 *
 * travel_* 欄位 NULL，背景 tp-request 之後 fill（避免 LLM 8 秒等待感）。
 */
import { logAudit } from '../../_audit';
import { hasWritePermission, requireAuth } from '../../_auth';
import { AppError } from '../../_errors';
import { detectGarbledText } from '../../_validate';
import { json, parseIntParam, parseJsonBody } from '../../_utils';
import { defaultStartFor, addMinutes, stayMinutesFor, TIME_RE } from '../../_poi-defaults';
import type { Env } from '../../_types';

interface Body {
  tripId?: string;
  dayNum?: number;
  position?: 'append' | 'before' | 'after' | 'replace';
  anchorEntryId?: number;
  startTime?: string;
  endTime?: string;
}

const VALID_POSITIONS = new Set(['append', 'before', 'after', 'replace']);

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
  if (!VALID_POSITIONS.has(position)) {
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

  // Parallelize 3 independent reads (saved POI + write permission + day existence)
  const [saved, hasWrite, day] = await Promise.all([
    db
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
      }>(),
    hasWritePermission(db, auth, tripId, auth.isAdmin),
    db
      .prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = ?')
      .bind(tripId, dayNum)
      .first<{ id: number }>(),
  ]);

  if (!saved) throw new AppError('DATA_NOT_FOUND', '找不到該收藏');
  const ownByUid = auth.userId !== null && saved.user_id === auth.userId;
  if (!ownByUid && !auth.isAdmin) {
    throw new AppError('PERM_DENIED', '只能加入自己的收藏');
  }
  if (!hasWrite) throw new AppError('PERM_DENIED');
  if (!day) throw new AppError('DATA_NOT_FOUND', `Day ${dayNum} 不存在`);

  // saved.note 若有亂碼（CP950 → UTF-8 誤轉等），擋下避免污染 trip_entries
  if (saved.note && detectGarbledText(saved.note)) {
    throw new AppError('DATA_ENCODING', '收藏 note 包含疑似亂碼，請先到「我的收藏」修正');
  }

  // sort_order 計算 + 騰位 stmts
  const stmts: D1PreparedStatement[] = [];
  let sortOrder: number;
  if (position === 'append') {
    const max = await db
      .prepare('SELECT MAX(sort_order) AS max_sort FROM trip_entries WHERE day_id = ?')
      .bind(day.id)
      .first<{ max_sort: number | null }>();
    sortOrder = (max?.max_sort ?? -1) + 1;
  } else {
    const anchor = await db
      .prepare('SELECT sort_order FROM trip_entries WHERE id = ? AND day_id = ?')
      .bind(anchorEntryId!, day.id)
      .first<{ sort_order: number }>();
    if (!anchor) throw new AppError('DATA_NOT_FOUND', 'anchorEntryId 不在該天');

    if (position === 'replace') {
      sortOrder = anchor.sort_order;
      stmts.push(db.prepare('DELETE FROM trip_entries WHERE id = ?').bind(anchorEntryId!));
    } else {
      sortOrder = position === 'before' ? anchor.sort_order : anchor.sort_order + 1;
      stmts.push(
        db.prepare('UPDATE trip_entries SET sort_order = sort_order + 1 WHERE day_id = ? AND sort_order >= ?')
          .bind(day.id, sortOrder),
      );
    }
  }

  const start = startTime ?? defaultStartFor(saved.poi_type);
  const end = endTime ?? addMinutes(start, stayMinutesFor(saved.poi_type));

  // INSERT entry first with RETURNING — atomic id retrieval (no race read-back)
  if (stmts.length > 0) await db.batch(stmts);

  const created = await db
    .prepare(
      `INSERT INTO trip_entries (day_id, sort_order, time, title, description, source, note, poi_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(day.id, sortOrder, `${start}-${end}`, saved.poi_name, null, 'fast-path', saved.note, saved.poi_id)
    .first<{ id: number }>();
  const newEntryId = created?.id ?? null;
  if (newEntryId === null) {
    throw new AppError('SYS_INTERNAL', 'INSERT trip_entries RETURNING 未回傳 id');
  }

  // trip_pois link (per-trip POI metadata)
  await db
    .prepare(
      `INSERT INTO trip_pois (trip_id, poi_id, context, day_id, entry_id, source)
       VALUES (?, ?, 'timeline', ?, ?, 'fast-path')`,
    )
    .bind(tripId, saved.poi_id, day.id, newEntryId)
    .run();

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
