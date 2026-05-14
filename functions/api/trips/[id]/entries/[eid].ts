import { logAudit, computeDiff } from '../../../_audit';
import { hasPermission, hasWritePermission, verifyEntryBelongsToTrip } from '../../../_auth';
import { AppError } from '../../../_errors';
import { TIME_RE, parseTime } from '../../../_time';
import { validateEntryBody, detectGarbledText } from '../../../_validate';
import { json, getAuth, parseJsonBody, parseIntParam, buildUpdateClause } from '../../../_utils';
import type { Env } from '../../../_types';
import { fetchEntryPoisByEntries } from '../days/_merge';

// Phase 3：移除 location / maps / mapcode / rating — 這些欄位已 DROP，POI master JOIN 取代。
// POI 重掛走 PUT /api/trips/:id/entries/:eid/poi-id（獨立端點，驗證 POI 存在）。
// v2.10 Wave 1 (Item 3 move 跨天)：加 day_id — 須驗證 targetDay 屬於同 trip，
// 不可改成不同 trip 的 day_id（防越權）。
// v2.26.0 (migration 0056)：start_time / end_time 拆分 time。dual-write 觀察期：
//   - body 若帶 start_time/end_time → 寫入 start/end + 同步 compose 寫 time
//   - body 若帶 time（legacy）→ 寫 time + parseTime compose start/end
// helpers (TIME_RE / parseTime) 共用 _time.ts。
// v2.29.0: trip_entries.{time, travel_type, travel_desc, travel_min} DROPPED.
// PATCH 不再 accept 這些 field（schema 已無對應 col）。
const ALLOWED_FIELDS = ['day_id', 'sort_order', 'start_time', 'end_time', 'title', 'description', 'source', 'note'] as const;

/**
 * GET /api/trips/:id/entries/:eid → single entry meta + canonical entry POIs.
 *
 * v2.19.13: EntryActionPage (move/copy) 載 entry 當前 day_id 用,本來在 prod
 * 沒這 handler 直接 405,move/copy flow broken。讀權限走 hasPermission (viewer
 * 也可看)。
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, eid: eidStr } = context.params as { id: string; eid: string };
  const eid = parseIntParam(eidStr);
  if (!eid) throw new AppError('DATA_VALIDATION', 'ID 格式錯誤');
  const db = context.env.DB;

  const [hasPerm, belongsToTrip] = await Promise.all([
    hasPermission(db, auth, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, eid, id),
  ]);
  if (!hasPerm) throw new AppError('PERM_DENIED');
  if (!belongsToTrip) throw new AppError('DATA_NOT_FOUND');

  const row = await db
    .prepare('SELECT * FROM trip_entries WHERE id = ?')
    .bind(eid)
    .first<Record<string, unknown>>();
  if (!row) throw new AppError('DATA_NOT_FOUND');

  const entryPois = await fetchEntryPoisByEntries(db, [eid]);
  const bucket = entryPois.get(eid) ?? { master: null, alternates: [], stopPois: [], version: String(row.entry_pois_version ?? 0) };
  const master = bucket.master;
  const { poi_id: _legacyPoiId, ...entryFields } = row;
  void _legacyPoiId;

  return json({
    ...entryFields,
    master,
    alternates: bucket.alternates,
    stop_pois: bucket.stopPois,
    entry_pois_version: bucket.version,
  });
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
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

  const oldRow = await db.prepare('SELECT * FROM trip_entries WHERE id = ?').bind(eid).first() as Record<string, unknown> | null;
  if (!oldRow) throw new AppError('DATA_NOT_FOUND');

  const body = await parseJsonBody<Record<string, unknown>>(context.request);

  // 驗證必填欄位（title 若包含在更新欄位中則不得為空）
  if ('title' in body) {
    const validation = validateEntryBody(body);
    if (!validation.ok) throw new AppError('DATA_VALIDATION', validation.error);
  }

  // 亂碼偵測：寫入 DB 前檢查文字欄位
  const textFields = ['title', 'description', 'note'];
  for (const f of textFields) {
    if (f in body && typeof body[f] === 'string' && detectGarbledText(body[f] as string)) {
      throw new AppError('DATA_ENCODING', `欄位 ${f} 包含疑似亂碼，請確認 encoding 為 UTF-8`);
    }
  }

  // v2.10 Wave 1: day_id move 跨天驗證 — 防止把 entry 移到別 trip 的 day。
  if ('day_id' in body) {
    const targetDayId = body.day_id;
    if (typeof targetDayId !== 'number' || !Number.isInteger(targetDayId) || targetDayId <= 0) {
      throw new AppError('DATA_VALIDATION', 'day_id 必須是正整數');
    }
    const targetDay = await db
      .prepare('SELECT trip_id FROM trip_days WHERE id = ?')
      .bind(targetDayId)
      .first() as { trip_id: string } | null;
    if (!targetDay) throw new AppError('DATA_NOT_FOUND', '指定的 day 不存在');
    if (targetDay.trip_id !== id) throw new AppError('PERM_DENIED', '不可將 entry 移到其他 trip');
  }

  // v2.29.0: trip_entries.time DROPPED. 只接受 start_time / end_time。
  // 為 backward-compat 仍接 legacy body.time → parse 拆成 start/end（但不寫回 time col）。
  for (const f of ['start_time', 'end_time'] as const) {
    if (f in body && body[f] !== null && body[f] !== '' && typeof body[f] === 'string') {
      if (!TIME_RE.test(body[f] as string)) {
        throw new AppError('DATA_VALIDATION', `${f} 必須符合 HH:MM 格式`);
      }
    }
  }
  if ('start_time' in body || 'end_time' in body) {
    const start = ('start_time' in body ? body.start_time : oldRow.start_time) as string | null | undefined;
    const end = ('end_time' in body ? body.end_time : oldRow.end_time) as string | null | undefined;
    // 驗證 effective merge state（不只看 body）— 防 client 只送 start_time
    // 但 oldRow 既有 end_time 比新 start_time 早造成 inverted range。
    if (typeof start === 'string' && typeof end === 'string' && start && end && start >= end) {
      throw new AppError('DATA_VALIDATION', 'start_time 必須早於 end_time');
    }
  } else if ('time' in body && typeof body.time === 'string') {
    const parsed = parseTime(body.time);
    body.start_time = parsed.start;
    body.end_time = parsed.end;
    delete body.time;
  } else if ('time' in body && body.time === null) {
    body.start_time = null;
    body.end_time = null;
    delete body.time;
  }

  const update = buildUpdateClause(body, ALLOWED_FIELDS);
  if (!update) throw new AppError('DATA_VALIDATION', '無有效欄位可更新');

  let row;
  try {
    row = await db
      .prepare(`UPDATE trip_entries SET ${update.setClauses} WHERE id = ? RETURNING *`)
      .bind(...update.values, eid)
      .first();
  } catch (err: unknown) {
    throw new AppError('SYS_DB_ERROR', 'DB 暫時無法處理，請稍後重試');
  }

  if (!row) throw new AppError('DATA_NOT_FOUND');

  const newFields = Object.fromEntries(update.fields.map(f => [f, body[f]]));
  await logAudit(db, {
    tripId: id,
    tableName: 'trip_entries',
    recordId: eid,
    action: 'update',
    changedBy,
    diffJson: computeDiff(oldRow, newFields),
  });

  return json(row);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, eid: eidStr } = context.params as { id: string; eid: string };
  const eid = parseIntParam(eidStr);
  if (!eid) throw new AppError('DATA_VALIDATION', 'ID 格式錯誤');
  const db = context.env.DB;
  const changedBy = auth.email;

  const [hasPerm2, belongsToTrip2] = await Promise.all([
    hasWritePermission(db, auth, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, eid, id),
  ]);
  if (!hasPerm2) throw new AppError('PERM_DENIED');
  if (!belongsToTrip2) throw new AppError('DATA_NOT_FOUND');

  const oldRow = await db.prepare('SELECT * FROM trip_entries WHERE id = ?').bind(eid).first() as Record<string, unknown> | null;
  if (!oldRow) throw new AppError('DATA_NOT_FOUND');

  // v2.29.0: trip_pois DROPPED. trip_entry_pois has ON DELETE CASCADE so the entry delete cascades.
  try {
    await db.prepare('DELETE FROM trip_entries WHERE id = ?').bind(eid).run();
  } catch (err: unknown) {
    throw new AppError('SYS_DB_ERROR', 'DB 暫時無法處理，請稍後重試');
  }

  await logAudit(db, {
    tripId: id,
    tableName: 'trip_entries',
    recordId: eid,
    action: 'delete',
    changedBy,
    snapshot: JSON.stringify(oldRow),
  });

  return json({ ok: true });
};
