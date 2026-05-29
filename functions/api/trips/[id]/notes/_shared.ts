/**
 * Shared helpers for per-section trip notes endpoints.
 *
 * v2.34.x 行程筆記 PR2 (GET) + PR3 (POST / PATCH / DELETE / reorder)。
 * 5 個 section 共用：auth check + SELECT * / INSERT / UPDATE / DELETE / reorder。
 * 抽出來避免 5 個 file 各寫一次。
 */
import { hasPermission, hasWritePermission, requireAuth } from '../../../_auth';
import { logAudit, computeDiff } from '../../../_audit';
import { AppError } from '../../../_errors';
import { buildUpdateClause, json, parseIntParam, parseJsonBody } from '../../../_utils';
import type { Env } from '../../../_types';

export type NotesTable =
  | 'trip_flights'
  | 'trip_lodgings'
  | 'trip_reservations'
  | 'trip_pretrip_notes'
  | 'trip_emergency_contacts';

// Per-section writable fields whitelist。snake_case 對齊 DB column + 對齊 entries
// pattern。`version` 永遠不在 whitelist — autosave 用 body.expectedVersion + SQL
// `SET version = version + 1` CAS（同 trip_entries v2.33.108 pattern）。
// `trip_id` 也不在 — 路徑 param 提供，body 不該帶 (防越權改 trip_id)。
export const ALLOWED_FIELDS: Record<NotesTable, readonly string[]> = {
  trip_flights: [
    'sort_order', 'airline', 'flight_no', 'cabin_class',
    'depart_airport', 'arrive_airport', 'depart_at', 'arrive_at', 'note',
  ],
  trip_lodgings: [
    // v2.34.44 PR44 migration 0074: day_id INTEGER → trip_lodging_days junction table
    'sort_order', 'name', 'address', 'check_in_at', 'check_out_at',
    'booking_no', 'phone', 'note',
  ],
  trip_reservations: [
    'sort_order', 'kind', 'title', 'reserved_at', 'party_size',
    'reservation_no', 'phone', 'note',
  ],
  trip_pretrip_notes: [
    'sort_order', 'section', 'title', 'content', 'ai_generated', 'ai_source',
  ],
  trip_emergency_contacts: [
    'sort_order', 'name', 'relationship', 'phone', 'email', 'kind', 'ai_generated',
  ],
};

// CHECK enum validation（DB 也有 CHECK，這層補 415 而不是丟 500）
const KIND_ENUMS: Partial<Record<NotesTable, readonly string[]>> = {
  trip_reservations: ['restaurant', 'experience', 'ticket', 'transport', 'other'],
  trip_emergency_contacts: ['personal', 'embassy', 'police', 'medical', 'insurance', 'hotel', 'other'],
};

const AI_SOURCE_ENUM = ['lodging-tips', 'general-tips'] as const;

// ============================================================================
// READ (GET) — 既有 PR2 endpoint
// ============================================================================

export async function listNotesSection(
  context: EventContext<Env, string, Record<string, unknown>>,
  table: NotesTable,
): Promise<Response> {
  const { env, params } = context;
  const auth = requireAuth(context);
  const tripId = params.id as string;

  if (!(await hasPermission(env.DB, auth, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  const { results } = await env.DB
    .prepare(`SELECT * FROM ${table} WHERE trip_id = ? ORDER BY sort_order ASC, id ASC`)
    .bind(tripId)
    .all<Record<string, unknown>>();

  let items: Record<string, unknown>[] = results ?? [];

  // v2.34.44 PR44: trip_lodgings 需 batch fetch trip_lodging_days junction
  if (table === 'trip_lodgings' && items.length > 0) {
    const lodgingIds = items.map((r) => r.id as number);
    const placeholders = lodgingIds.map(() => '?').join(', ');
    const { results: junctionRows } = await env.DB
      .prepare(`SELECT lodging_id, day_id FROM trip_lodging_days WHERE lodging_id IN (${placeholders})`)
      .bind(...lodgingIds)
      .all<{ lodging_id: number; day_id: number }>();
    const byLodgingId = new Map<number, number[]>();
    for (const j of junctionRows ?? []) {
      const arr = byLodgingId.get(j.lodging_id) ?? [];
      arr.push(j.day_id);
      byLodgingId.set(j.lodging_id, arr);
    }
    items = items.map((r) => ({ ...r, day_ids: byLodgingId.get(r.id as number) ?? [] }));
  }

  return json({ items });
}

/**
 * v2.34.44 PR44: 替換 lodging 的 day_ids junction row。
 * @param db D1 binding
 * @param lodgingId — 該 lodging row id
 * @param dayIds — 新 day_ids 陣列；空陣列代表清空
 */
async function replaceLodgingDayIds(db: D1Database, lodgingId: number, dayIds: number[]): Promise<void> {
  // Atomic: DELETE + INSERT 在 batch
  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM trip_lodging_days WHERE lodging_id = ?').bind(lodgingId),
  ];
  for (const dayId of dayIds) {
    if (!Number.isInteger(dayId) || dayId <= 0) {
      throw new AppError('DATA_VALIDATION', `day_ids 元素必須是正整數，得到 ${JSON.stringify(dayId)}`);
    }
    stmts.push(
      db.prepare('INSERT INTO trip_lodging_days (lodging_id, day_id) VALUES (?, ?)').bind(lodgingId, dayId),
    );
  }
  await db.batch(stmts);
}

function extractDayIds(body: Record<string, unknown>): number[] | undefined {
  if (!('day_ids' in body)) return undefined;
  const raw = body.day_ids;
  if (!Array.isArray(raw)) {
    throw new AppError('DATA_VALIDATION', 'day_ids 必須是 number array');
  }
  // de-dup + sort ascending
  const ids = Array.from(new Set(raw.map((v) => Number(v)))).sort((a, b) => a - b);
  return ids;
}

// ============================================================================
// CREATE (POST) — body snake_case，回 row + 201
// ============================================================================

export async function createNotesRow(
  context: EventContext<Env, string, Record<string, unknown>>,
  table: NotesTable,
): Promise<Response> {
  const { env, params } = context;
  const auth = requireAuth(context);
  const tripId = params.id as string;

  if (!(await hasWritePermission(env.DB, auth, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  const body = await parseJsonBody<Record<string, unknown>>(context.request);
  validateEnums(table, body);

  // Auto-assign sort_order = MAX+1 if not provided（保持新 row 排最後）
  if (!('sort_order' in body)) {
    const max = await env.DB
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM ${table} WHERE trip_id = ?`)
      .bind(tripId)
      .first<{ m: number }>();
    body.sort_order = (max?.m ?? -1) + 1;
  }

  // v2.34.44 PR44: trip_lodgings 額外處理 day_ids junction（不在 ALLOWED_FIELDS）
  const dayIds = table === 'trip_lodgings' ? extractDayIds(body) : undefined;

  const allowed = ALLOWED_FIELDS[table];
  const fields = Object.keys(body).filter((k) => (allowed as readonly string[]).includes(k));
  // trip_id 永遠由 path param 提供，不從 body
  const cols = ['trip_id', ...fields];
  const placeholders = cols.map(() => '?').join(', ');
  const values = [tripId, ...fields.map((f) => body[f])];

  const row = await env.DB
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`)
    .bind(...values)
    .first<Record<string, unknown>>();

  // v2.34.44 PR44: trip_lodgings junction
  if (row && table === 'trip_lodgings' && dayIds !== undefined) {
    await replaceLodgingDayIds(env.DB, row.id as number, dayIds);
  }

  // PR26: audit log for create
  if (row) {
    const auditPayload = table === 'trip_lodgings' ? { ...row, day_ids: dayIds ?? [] } : row;
    await logAudit(env.DB, {
      tripId,
      tableName: table,
      recordId: row.id as number,
      action: 'insert',
      changedBy: auth.email,
      diffJson: JSON.stringify(auditPayload),
    });
  }

  // Echo day_ids in response so client can immediately use it
  if (row && table === 'trip_lodgings') {
    return json({ ...row, day_ids: dayIds ?? [] }, 201);
  }
  return json(row, 201);
}

// ============================================================================
// UPDATE (PATCH) — body snake_case + optional expectedVersion OCC
// ============================================================================

export async function updateNotesRow(
  context: EventContext<Env, string, Record<string, unknown>>,
  table: NotesTable,
): Promise<Response> {
  const { env, params } = context;
  const auth = requireAuth(context);
  const tripId = params.id as string;
  const rowId = parseIntParam((params.rowId ?? params.id) as string);
  // 注意：params.id 是 trip-id (string)，rowId 是 numeric — 從第二個 [rowId] segment
  // CF Pages 把 [rowId] 變 params.rowId。
  if (!params.rowId) throw new AppError('DATA_VALIDATION', 'rowId 缺失');
  const id = parseIntParam(params.rowId as string);
  if (!id) throw new AppError('DATA_VALIDATION', 'rowId 必須是正整數');
  void rowId; // unused now

  if (!(await hasWritePermission(env.DB, auth, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  // 驗證 row 屬於該 trip（防越權）+ 抓 oldRow 給 audit diff
  const oldRow = await env.DB
    .prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
  if (!oldRow) throw new AppError('DATA_NOT_FOUND');
  if (oldRow.trip_id !== tripId) throw new AppError('PERM_DENIED', '此 row 不屬於該 trip');

  const body = await parseJsonBody<Record<string, unknown>>(context.request);
  validateEnums(table, body);

  // OCC token — 對齊 entries [eid].ts pattern
  const expectedVersion = typeof body.expectedVersion === 'number'
    && Number.isInteger(body.expectedVersion)
    ? body.expectedVersion
    : null;
  if (expectedVersion !== null) delete body.expectedVersion;

  // v2.34.44 PR44: trip_lodgings 額外處理 day_ids junction
  const dayIds = table === 'trip_lodgings' ? extractDayIds(body) : undefined;

  const update = buildUpdateClause(body, ALLOWED_FIELDS[table]);
  // 若只更新 day_ids（day_ids 不在 ALLOWED_FIELDS），buildUpdateClause 回 null。
  // 仍要 bump version + replace junction，所以特殊 handle。
  if (!update && dayIds === undefined) {
    throw new AppError('DATA_VALIDATION', '無有效欄位可更新');
  }

  let row;
  try {
    if (update) {
      const setClausesWithVersion = `${update.setClauses}, version = version + 1`;
      if (expectedVersion !== null) {
        row = await env.DB
          .prepare(`UPDATE ${table} SET ${setClausesWithVersion} WHERE id = ? AND version = ? RETURNING *`)
          .bind(...update.values, id, expectedVersion)
          .first<Record<string, unknown>>();
        if (!row) {
          const cur = await env.DB
            .prepare(`SELECT version FROM ${table} WHERE id = ?`)
            .bind(id)
            .first<{ version: number }>();
          if (!cur) throw new AppError('DATA_NOT_FOUND');
          throw new AppError('STALE_ENTRY', `expected version ${expectedVersion}, current ${cur.version}`);
        }
      } else {
        row = await env.DB
          .prepare(`UPDATE ${table} SET ${setClausesWithVersion} WHERE id = ? RETURNING *`)
          .bind(...update.values, id)
          .first<Record<string, unknown>>();
      }
    } else {
      // 只更新 day_ids — 仍 bump version
      if (expectedVersion !== null) {
        row = await env.DB
          .prepare(`UPDATE ${table} SET version = version + 1 WHERE id = ? AND version = ? RETURNING *`)
          .bind(id, expectedVersion)
          .first<Record<string, unknown>>();
        if (!row) {
          throw new AppError('STALE_ENTRY', `expected version ${expectedVersion}`);
        }
      } else {
        row = await env.DB
          .prepare(`UPDATE ${table} SET version = version + 1 WHERE id = ? RETURNING *`)
          .bind(id)
          .first<Record<string, unknown>>();
      }
    }
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (/CHECK constraint/i.test(msg) || /SQLITE_CONSTRAINT_CHECK/i.test(msg)) {
      throw new AppError('DATA_VALIDATION', 'CHECK constraint failed (enum 違反)');
    }
    if (/FOREIGN KEY constraint/i.test(msg) || /SQLITE_CONSTRAINT_FOREIGNKEY/i.test(msg)) {
      throw new AppError('DATA_VALIDATION', '欄位參考的資料不存在');
    }
    throw err;
  }

  // v2.34.44 PR44: replace junction（若 body 含 day_ids）
  if (row && table === 'trip_lodgings' && dayIds !== undefined) {
    await replaceLodgingDayIds(env.DB, id, dayIds);
  }

  // PR26: audit log for update
  if (row) {
    const newFields = update
      ? Object.fromEntries(update.fields.map((f) => [f, body[f]]))
      : {};
    if (dayIds !== undefined) {
      (newFields as Record<string, unknown>).day_ids = dayIds;
    }
    await logAudit(env.DB, {
      tripId,
      tableName: table,
      recordId: id,
      action: 'update',
      changedBy: auth.email,
      diffJson: computeDiff(oldRow, newFields),
    });
  }

  // Echo day_ids
  if (row && table === 'trip_lodgings') {
    const finalDayIds = dayIds ?? await loadLodgingDayIds(env.DB, id);
    return json({ ...row, day_ids: finalDayIds });
  }
  return json(row);
}

/** v2.34.44 PR44: 讀單一 lodging 的 day_ids 陣列 */
async function loadLodgingDayIds(db: D1Database, lodgingId: number): Promise<number[]> {
  const { results } = await db
    .prepare('SELECT day_id FROM trip_lodging_days WHERE lodging_id = ? ORDER BY day_id ASC')
    .bind(lodgingId)
    .all<{ day_id: number }>();
  return (results ?? []).map((r) => r.day_id);
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteNotesRow(
  context: EventContext<Env, string, Record<string, unknown>>,
  table: NotesTable,
): Promise<Response> {
  const { env, params } = context;
  const auth = requireAuth(context);
  const tripId = params.id as string;
  if (!params.rowId) throw new AppError('DATA_VALIDATION', 'rowId 缺失');
  const id = parseIntParam(params.rowId as string);
  if (!id) throw new AppError('DATA_VALIDATION', 'rowId 必須是正整數');

  if (!(await hasWritePermission(env.DB, auth, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  const oldRow = await env.DB
    .prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
  if (!oldRow) throw new AppError('DATA_NOT_FOUND');
  if (oldRow.trip_id !== tripId) throw new AppError('PERM_DENIED', '此 row 不屬於該 trip');

  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();

  // PR26: audit log for delete
  await logAudit(env.DB, {
    tripId,
    tableName: table,
    recordId: id,
    action: 'delete',
    changedBy: auth.email,
    diffJson: JSON.stringify(oldRow),
  });

  return json({ ok: true });
}

// ============================================================================
// REORDER — bulk update sort_order for N rows in one trip
// body: { items: [{ id, sortOrder }, ...] }
// 所有 id 必須屬於同 trip + 同 table，atomicity 走 batch (D1 supports prepare batch)
// ============================================================================

export async function reorderNotesRows(
  context: EventContext<Env, string, Record<string, unknown>>,
  table: NotesTable,
): Promise<Response> {
  const { env, params } = context;
  const auth = requireAuth(context);
  const tripId = params.id as string;

  if (!(await hasWritePermission(env.DB, auth, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  const body = await parseJsonBody<{ items?: Array<{ id?: number; sortOrder?: number }> }>(context.request);
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) throw new AppError('DATA_VALIDATION', 'items 必須是非空陣列');

  // 驗 input 型別
  for (const it of items) {
    if (typeof it.id !== 'number' || !Number.isInteger(it.id) || it.id <= 0) {
      throw new AppError('DATA_VALIDATION', `id 必須是正整數，得到 ${JSON.stringify(it.id)}`);
    }
    if (typeof it.sortOrder !== 'number' || !Number.isInteger(it.sortOrder) || it.sortOrder < 0) {
      throw new AppError('DATA_VALIDATION', `sortOrder 必須是非負整數`);
    }
  }

  // 一次 SELECT 確認所有 id 都屬於該 trip（防越權）
  const ids = items.map((it) => it.id!);
  const placeholders = ids.map(() => '?').join(', ');
  const { results: existing } = await env.DB
    .prepare(`SELECT id FROM ${table} WHERE trip_id = ? AND id IN (${placeholders})`)
    .bind(tripId, ...ids)
    .all<{ id: number }>();
  if ((existing?.length ?? 0) !== ids.length) {
    throw new AppError('PERM_DENIED', '部分 id 不屬於該 trip 或不存在');
  }

  // Batch UPDATE — D1 batch atomic
  const stmts = items.map((it) =>
    env.DB
      .prepare(`UPDATE ${table} SET sort_order = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(it.sortOrder, it.id),
  );
  await env.DB.batch(stmts);

  // PR26: audit log for reorder — recordId=null + action='update' + 摘要 diff（bulk 不寫 per-row 噪音）
  await logAudit(env.DB, {
    tripId,
    tableName: table,
    recordId: null,
    action: 'update',
    changedBy: auth.email,
    diffJson: JSON.stringify({ op: 'reorder', items: items.map((it) => ({ id: it.id, sortOrder: it.sortOrder })) }),
  });

  return json({ ok: true, updated: items.length });
}

// ============================================================================
// Validation helper — enum check
// ============================================================================

function validateEnums(table: NotesTable, body: Record<string, unknown>) {
  const kindEnum = KIND_ENUMS[table];
  if (kindEnum && 'kind' in body && typeof body.kind === 'string') {
    if (!(kindEnum as readonly string[]).includes(body.kind)) {
      throw new AppError('DATA_VALIDATION', `kind 必須是 ${kindEnum.join('/')} 之一`);
    }
  }
  if (table === 'trip_pretrip_notes' && 'ai_source' in body && body.ai_source !== null) {
    if (typeof body.ai_source !== 'string' || !(AI_SOURCE_ENUM as readonly string[]).includes(body.ai_source)) {
      throw new AppError('DATA_VALIDATION', `ai_source 必須是 ${AI_SOURCE_ENUM.join('/')} 之一或 null`);
    }
  }
}
