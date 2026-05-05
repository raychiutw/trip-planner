/**
 * POST /api/poi-favorites/:id/add-to-trip — 從「收藏」加入指定 trip 的 fast-path。
 *
 * Body（poi-favorites-rename §9 + design D14 — 4-field 純時間驅動）：
 *   { tripId, dayNum, startTime, endTime, companionRequestId? }
 *
 * 廢除欄位：position / anchorEntryId（送上 → 400「欄位已廢除」）。
 *
 * Server 依 startTime 自動計算 sort_order（找該 day 中所有 entries，將新 entry 排在
 * startTime 之後第一個 entry 之前；若沒有更晚 entry 則 append 到末尾）。
 * Conflict detection 邏輯保留：newStart < eEnd AND newEnd > eStart → 409 + conflictWith。
 *
 * Auth：
 *   - V2 user：必須是 favorite owner（OR admin bypass）+ 對 tripId 有 hasWritePermission
 *   - companion：requireFavoriteActor(action='add_to_trip')；ownership 用 resolved
 *     userId（submitter）比 favorite.user_id；admin scope 不 bypass。
 *
 * travel_* 欄位 NULL，背景 tp-request 之後 fill（避免 LLM 8 秒等待感）。
 */
import { logAudit } from '../../_audit';
import { hasWritePermission } from '../../_auth';
import { AppError, buildRateLimitResponse } from '../../_errors';
import { detectGarbledText } from '../../_validate';
import { json, parseIntParam, parseJsonBody } from '../../_utils';
import { TIME_RE } from '../../_poi-defaults';
import { assertFavoriteOwnership, pickFavoriteRateLimitBucket, requireFavoriteActor } from '../../_companion';
import { bumpRateLimit, RATE_LIMITS } from '../../_rate_limit';
import type { Env, AuthData } from '../../_types';

interface Body {
  tripId?: string;
  dayNum?: number;
  startTime?: string;
  endTime?: string;
  companionRequestId?: number;
  // 廢除欄位，存在即 reject
  position?: unknown;
  anchorEntryId?: unknown;
}

/** Parse "HH:MM-HH:MM" → [startMin, endMin]; null if not parseable. */
function parseTimeRange(time: string | null | undefined): [number, number] | null {
  if (!time) return null;
  const m = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const [, h1, m1, h2, m2] = m;
  return [parseInt(h1!, 10) * 60 + parseInt(m1!, 10), parseInt(h2!, 10) * 60 + parseInt(m2!, 10)];
}

/** "HH:MM" → minutes since midnight. */
function hhmmToMin(t: string): number {
  const [h, m] = t.split(':');
  return parseInt(h!, 10) * 60 + parseInt(m!, 10);
}

export const onRequestPost: PagesFunction<Env, 'id'> = async (context) => {
  const auth = (context.data as { auth?: AuthData }).auth ?? null;
  const favoriteId = parseIntParam(context.params.id as string);
  if (!favoriteId) throw new AppError('DATA_VALIDATION', 'favoriteId 須為正整數');

  const body = await parseJsonBody<Body>(context.request);

  // 廢除欄位 reject — 防止 client/skill 送 stale schema（design D14）
  if (body.position !== undefined || body.anchorEntryId !== undefined) {
    throw new AppError(
      'DATA_VALIDATION',
      'position / anchorEntryId 欄位已廢除（4-field 純時間驅動）：請改用 startTime + endTime',
    );
  }

  const { tripId, dayNum, startTime, endTime } = body;
  if (!tripId) throw new AppError('DATA_VALIDATION', '缺少 tripId');
  if (!Number.isInteger(dayNum) || (dayNum as number) < 1) {
    throw new AppError('DATA_VALIDATION', 'dayNum 須為 ≥1 的整數');
  }
  if (!startTime || !TIME_RE.test(startTime)) {
    throw new AppError('DATA_VALIDATION', 'startTime 必填，須為 HH:MM 格式');
  }
  if (!endTime || !TIME_RE.test(endTime)) {
    throw new AppError('DATA_VALIDATION', 'endTime 必填，須為 HH:MM 格式');
  }

  // Rate limit — bucket key 與 POST /api/poi-favorites 區隔（自己一池），避免互相吃 quota。
  const rlBucket = pickFavoriteRateLimitBucket(context.request, body, 'poi-favorites-add-to-trip', auth);
  if (rlBucket) {
    const bump = await bumpRateLimit(context.env.DB, rlBucket, RATE_LIMITS.POI_FAVORITES_WRITE);
    if (!bump.ok) return buildRateLimitResponse(bump.retryAfter ?? 60, { error: 'RATE_LIMITED' });
  }

  // Resolve effective actor（V2 user 或 companion submitter；gate 失敗 → 401）
  const actor = await requireFavoriteActor(context, body, 'add_to_trip');

  const db = context.env.DB;

  // Parallel reads：favorite + write permission + day existence
  const [favorite, hasWrite, day] = await Promise.all([
    db
      .prepare(
        `SELECT pf.id, pf.user_id, pf.poi_id, pf.note,
                p.name AS poi_name, p.type AS poi_type
         FROM poi_favorites pf
         JOIN pois p ON p.id = pf.poi_id
         WHERE pf.id = ?`,
      )
      .bind(favoriteId)
      .first<{
        id: number;
        user_id: string | null;
        poi_id: number;
        note: string | null;
        poi_name: string;
        poi_type: string;
      }>(),
    actor.isCompanion
      ? // companion 模式：用 submitter (actor.userId) 對 body.tripId 檢查 write 權限。
        // 防止 prompt-injected message 將 POI 加進 submitter 沒權限的 trip
        // （CSO audit finding：原 short-circuit `Promise.resolve(true)` 跳過 tripId guard）。
        db
          .prepare("SELECT 1 FROM trip_permissions WHERE user_id = ? AND trip_id = ? AND role != 'viewer'")
          .bind(actor.userId, tripId)
          .first()
          .then((row) => !!row)
      : hasWritePermission(db, auth!, tripId, auth?.isAdmin ?? false),
    db
      .prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = ?')
      .bind(tripId, dayNum)
      .first<{ id: number }>(),
  ]);

  if (!favorite) throw new AppError('DATA_NOT_FOUND', '找不到該收藏');

  assertFavoriteOwnership(actor, auth, favorite.user_id, '只能加入自己的收藏');
  if (!hasWrite) throw new AppError('PERM_DENIED');
  if (!day) throw new AppError('DATA_NOT_FOUND', `Day ${dayNum} 不存在`);

  // 收藏 note 含亂碼 → 阻擋（避免污染 trip_entries）
  if (favorite.note && detectGarbledText(favorite.note)) {
    throw new AppError('DATA_ENCODING', '收藏 note 包含疑似亂碼，請先到「我的收藏」修正');
  }

  // Conflict detection + sort_order 計算（一次查 day 的所有 entries）
  const newStartMin = hhmmToMin(startTime);
  const newEndMin = hhmmToMin(endTime);
  const { results: dayEntries } = await db
    .prepare('SELECT id, time, title, sort_order FROM trip_entries WHERE day_id = ? ORDER BY sort_order ASC')
    .bind(day.id)
    .all<{ id: number; time: string | null; title: string; sort_order: number }>();

  for (const entry of dayEntries ?? []) {
    const range = parseTimeRange(entry.time);
    if (!range) continue;
    const [eStart, eEnd] = range;
    if (newStartMin < eEnd && newEndMin > eStart) {
      return json({
        error: 'CONFLICT',
        conflictWith: {
          entryId: entry.id,
          time: entry.time,
          title: entry.title,
          dayNum,
        },
      }, 409);
    }
  }

  // sort_order auto-calc：找 startTime 之後第一個 entry，將新 entry 排在它之前；
  // 若沒有更晚 entry → append 到末尾。已有 entry 但時間範圍無法 parse 視為早於。
  let insertSortOrder = (dayEntries?.length ?? 0); // default append
  for (const entry of dayEntries ?? []) {
    const range = parseTimeRange(entry.time);
    if (!range) continue;
    const [eStart] = range;
    if (eStart > newStartMin) {
      insertSortOrder = entry.sort_order;
      break;
    }
  }

  // Shift entries with sort_order >= insertSortOrder 往後讓位
  const stmts: D1PreparedStatement[] = [];
  if (insertSortOrder < (dayEntries?.length ?? 0)) {
    stmts.push(
      db
        .prepare('UPDATE trip_entries SET sort_order = sort_order + 1 WHERE day_id = ? AND sort_order >= ?')
        .bind(day.id, insertSortOrder),
    );
  }

  stmts.push(
    db.prepare(
      `INSERT INTO trip_entries (day_id, sort_order, time, title, description, source, note, poi_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ).bind(day.id, insertSortOrder, `${startTime}-${endTime}`, favorite.poi_name, null, 'fast-path', favorite.note, favorite.poi_id),
  );
  stmts.push(
    db.prepare(
      `INSERT INTO trip_pois (trip_id, poi_id, context, day_id, entry_id, source)
       VALUES (?, ?, 'timeline', ?, last_insert_rowid(), 'fast-path')`,
    ).bind(tripId, favorite.poi_id, day.id),
  );

  const batchResults = await db.batch<{ id: number }>(stmts);
  const insertEntryResult = batchResults[batchResults.length - 2];
  const newEntryId = insertEntryResult?.results?.[0]?.id ?? null;
  if (newEntryId === null) {
    throw new AppError('SYS_INTERNAL', 'INSERT trip_entries RETURNING 未回傳 id');
  }

  // Audit log — companion 走 system:companion sentinel + 攜 companionTripId 反查；
  // V2 user 走實際 tripId + auth.email。fire-and-forget 不阻塞 response。
  const auditDiff: Record<string, unknown> = {
    via: 'poi-favorites-fast-path',
    favoriteId,
    poiId: favorite.poi_id,
    dayNum,
    startTime,
    endTime,
  };
  if (actor.isCompanion) auditDiff.companionTripId = tripId;
  context.waitUntil(
    logAudit(db, {
      tripId: actor.isCompanion ? actor.audit.tripId : tripId,
      tableName: 'trip_entries',
      recordId: newEntryId,
      action: 'insert',
      changedBy: actor.isCompanion ? actor.audit.changedBy : (auth?.email ?? ''),
      requestId: actor.requestId,
      diffJson: JSON.stringify(auditDiff),
    }),
  );

  return json({
    ok: true,
    entryId: newEntryId,
    dayId: day.id,
    sortOrder: insertSortOrder,
    startTime,
    endTime,
    note: 'travel_* 欄位將由背景 tp-request 計算填入',
  }, 201);
};
