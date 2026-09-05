/**
 * entry intake（#1257）—— 「在某一天建立一個 entry 並掛上正選 POI」的單一 seam。
 *
 * 六條建立路徑（單筆 POST、收藏加入、複製、分享 clone、匯入、整日重寫）以前各自手刻
 * INSERT，規矩（note 帶入、version 初始、resort、audit、補償）散落且不一致 —— 收藏備註曾
 * 因此 silently 遺失。現在只有這裡知道怎麼建 entry；handler 只做解析、權限、呼叫、回應。
 *
 * 固定順序：resolve POI → 讓位 / append → INSERT entry（RETURNING id）→ INSERT 正選
 * entry_pois（含 note）→ resortDayByArrival（best-effort）→ logAudit。
 * D1 無 cross-statement transaction：正選寫入失敗 → 補償 DELETE entry，不留無 master 的孤兒。
 */
import { AppError } from './_errors';
import { findOrCreatePoi, type FindOrCreatePoiData, type ResolvePoiOptions } from './_poi';
import { resortDayByArrival } from './_entry_sort';
import { logAudit } from './_audit';

export type PoiRef =
  | { id: number }
  | { data: FindOrCreatePoiData; policy: ResolvePoiOptions['policy']; createdPoiIds?: number[] };

export interface CreateEntrySpec {
  dayId: number;
  poi: PoiRef;
  startTime: string | null;
  endTime: string | null;
  /** trip_entries.description（entry 層級）。 */
  description?: string | null;
  /** 正選 POI 的 per-POI note（migration 0078 後 entry 備註住這裡）。 */
  note?: string | null;
  /** trip_entries.source；預設 'ai'（對齊既有 INSERT 慣例）。 */
  source?: string | null;
  /**
   * 排序位置。缺省 = append 到當日最後。
   * shift=true 時既有 sort_order ≥ sortOrder 的 entry 往後讓位（insert-before）；
   * shift=false 直接寫該 sort_order（collision 由 resort 依抵達時間拉正）。
   */
  placement?: { sortOrder: number; shift?: boolean };
  /** 稽核：每一條建立路徑都必須留 audit_log（rollback 讀它）。 */
  audit: { tripId: string; changedBy: string; requestId?: number | null; diff?: Record<string, unknown> };
  /** 預設 true。整日重寫等批次呼叫端可在最後統一 resort 一次。 */
  resort?: boolean;
}

export interface CreateEntryResult {
  entryId: number;
  poiId: number;
  /** 新 entry 的 entry_pois_version 起始值，恆為 1（ADR-0006 OCC counter）。 */
  version: 1;
  /** INSERT ... RETURNING * 的完整 entry row（handler 直接回給 client 用）。 */
  row: Record<string, unknown>;
}

/** 正選／備選 junction 欄位（migration 0078 後 note 住 per-POI）。 */
export interface EntryPoiFields {
  description?: string | null;
  note?: string | null;
  reservation?: string | null;
  reservationUrl?: string | null;
}

// ── 唯二的 INSERT SQL：單筆與批次共用，column parity 由結構保證 ──
function entryInsertStmt(
  db: D1Database,
  e: { dayId: number; sortOrder: number; startTime: string | null; endTime: string | null; description?: string | null; source?: string | null; version: 0 | 1 },
): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO trip_entries (day_id, sort_order, start_time, end_time, description, source, entry_pois_version)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  ).bind(e.dayId, e.sortOrder, e.startTime, e.endTime, e.description ?? null, e.source ?? 'ai', e.version);
}

function entryPoiInsertStmt(
  db: D1Database,
  entryId: number,
  poiId: number,
  sortOrder: number,
  f: EntryPoiFields,
  now: string,
): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, added_at, updated_at, description, note, reservation, reservation_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(entryId, poiId, sortOrder, now, now, f.description ?? null, f.note ?? null, f.reservation ?? null, f.reservationUrl ?? null);
}

function auditInsertStmt(db: D1Database, a: { tripId: string; changedBy: string; requestId?: number | null }, entryId: number, diff: Record<string, unknown>): D1PreparedStatement {
  return db.prepare(
    'INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, request_id, diff_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(a.tripId, 'trip_entries', entryId, 'insert', a.changedBy, a.requestId ?? null, JSON.stringify(diff));
}

const BATCH_CHUNK = 50; // D1 ~100-statement-per-batch 上限之下

async function runChunked(db: D1Database, stmts: D1PreparedStatement[], onResult?: (r: D1Result, idx: number) => void): Promise<void> {
  for (let i = 0; i < stmts.length; i += BATCH_CHUNK) {
    const res = await db.batch(stmts.slice(i, i + BATCH_CHUNK));
    if (onResult) res.forEach((r, j) => onResult(r, i + j));
  }
}

async function resolvePoiRef(db: D1Database, poi: PoiRef): Promise<number> {
  if ('id' in poi) return poi.id;
  return findOrCreatePoi(db, poi.data, { policy: poi.policy, createdPoiIds: poi.createdPoiIds });
}

export async function createEntry(db: D1Database, spec: CreateEntrySpec): Promise<CreateEntryResult> {
  const poiId = await resolvePoiRef(db, spec.poi);

  // ── 排序位置 ──
  let sortOrder: number;
  const stmts: D1PreparedStatement[] = [];
  if (spec.placement) {
    sortOrder = spec.placement.sortOrder;
    if (spec.placement.shift) {
      stmts.push(
        db.prepare('UPDATE trip_entries SET sort_order = sort_order + 1 WHERE day_id = ? AND sort_order >= ?')
          .bind(spec.dayId, sortOrder),
      );
    }
  } else {
    const max = await db
      .prepare('SELECT MAX(sort_order) AS max_sort FROM trip_entries WHERE day_id = ?')
      .bind(spec.dayId)
      .first<{ max_sort: number | null }>();
    sortOrder = (max?.max_sort ?? -1) + 1;
  }

  // ── INSERT entry（RETURNING *，不依賴 last_insert_rowid 的 cross-statement 假設）──
  stmts.push(entryInsertStmt(db, { ...spec, sortOrder, version: 1 }));
  let row: Record<string, unknown> | undefined;
  try {
    const results = await db.batch<Record<string, unknown>>(stmts);
    row = results[results.length - 1]?.results?.[0];
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('SYS_DB_ERROR', 'DB 暫時無法處理，請稍後重試');
  }
  const entryId = row?.id;
  if (typeof entryId !== 'number' || entryId <= 0) {
    throw new AppError('DATA_SAVE_FAILED', 'INSERT trip_entries RETURNING 未回傳 id');
  }

  // ── 正選 entry_pois（含 note）；失敗 → 補償 DELETE ──
  const now = new Date().toISOString();
  try {
    await entryPoiInsertStmt(db, entryId, poiId, 1, { note: spec.note }, now).run();
  } catch (err) {
    console.error('[entry intake] master INSERT failed, compensating delete', { entryId, poiId, err });
    await db.prepare('DELETE FROM trip_entries WHERE id = ?').bind(entryId).run();
    throw new AppError('SYS_DB_ERROR', 'entry 建立失敗，請稍後重試');
  }

  // ── resort（best-effort：entry 已 commit，重排失敗不可回 5xx，否則 client 重試 → 重複）──
  if (spec.resort !== false) {
    try {
      await resortDayByArrival(db, spec.dayId);
    } catch (err) {
      console.error('[entry intake] resortDayByArrival failed (non-fatal)', err);
    }
  }

  await logAudit(db, {
    tripId: spec.audit.tripId,
    tableName: 'trip_entries',
    recordId: entryId,
    action: 'insert',
    changedBy: spec.audit.changedBy,
    requestId: spec.audit.requestId,
    diffJson: JSON.stringify({ poiId, sort_order: sortOrder, ...(spec.audit.diff ?? {}) }),
  });

  return { entryId, poiId, version: 1, row: row! };
}

// ── 批次入口：複製 / 分享 clone / 匯入 / 整日重寫 ──
//
// 這些路徑一次寫整趟或整天，逐筆 createEntry 會撞 CF 50 subrequest 上限，所以 POI 已由
// caller 批次 resolve、這裡只收 poiId。不變量與單筆相同：正選 sort_order=1、備選 >1、
// 同 entry 重複 POI 去重（UNIQUE(entry_id, poi_id)）、version = 有 POI ? 1 : 0、每筆 audit。
// resort 預設不做：這些路徑的 sort_order 是來源資料明示的順序。

export interface BatchEntrySpec {
  dayId: number;
  sortOrder: number;
  startTime: string | null;
  endTime: string | null;
  description?: string | null;
  source?: string | null;
  /** index 0 = 正選，其餘備選；poiId 已 resolve。 */
  pois: Array<{ poiId: number } & EntryPoiFields>;
}

export interface CreateEntriesBatchOptions {
  /** 給了就每筆 entry 一列 audit_log（rollback 讀它）。匯入／clone 用 trip 級 diff 即可。 */
  audit?: { tripId: string; changedBy: string; requestId?: number | null; diff?: Record<string, unknown> };
  /**
   * 與第一批 entry INSERT 同一個 db.batch 執行的前置 statement（整日重寫的 DELETE 舊 entries +
   * day version bump 要跟新 entries 原子替換）。
   */
  atomicWith?: D1PreparedStatement[];
  /** 每拿到一個 entry id 就回呼（匯入／clone 要逐步累積 createdEntryIds 供失敗 rollback）。 */
  onEntryId?: (entryId: number, idx: number) => void;
}

export async function createEntriesBatch(
  db: D1Database,
  specs: BatchEntrySpec[],
  opts: CreateEntriesBatchOptions,
): Promise<number[]> {
  if (specs.length === 0) {
    if (opts.atomicWith?.length) await db.batch(opts.atomicWith);
    return [];
  }
  const prelude = opts.atomicWith ?? [];
  const entryIds: number[] = [];
  await runChunked(
    db,
    [...prelude, ...specs.map((e) => entryInsertStmt(db, { ...e, version: e.pois.length > 0 ? 1 : 0 }))],
    (r, idx) => {
      if (idx < prelude.length) return;
      const id = (r.results?.[0] as { id?: unknown } | undefined)?.id;
      if (typeof id !== 'number' || id <= 0) {
        throw new AppError('SYS_DB_ERROR', `trip_entries INSERT RETURNING id missing at index ${idx - prelude.length}`);
      }
      entryIds.push(id);
      opts.onEntryId?.(id, idx - prelude.length);
    },
  );

  const now = new Date().toISOString();
  const tail: D1PreparedStatement[] = [];
  specs.forEach((e, i) => {
    const entryId = entryIds[i]!;
    const seen = new Set<number>();
    let so = 1;
    for (const p of e.pois) {
      if (seen.has(p.poiId)) continue;
      seen.add(p.poiId);
      tail.push(entryPoiInsertStmt(db, entryId, p.poiId, so++, p, now));
    }
    if (opts.audit) {
      tail.push(auditInsertStmt(db, opts.audit, entryId, { sort_order: e.sortOrder, poiIds: [...seen], ...(opts.audit.diff ?? {}) }));
    }
  });
  try {
    await runChunked(db, tail);
  } catch (err) {
    console.error('[entry intake] batch entry_pois failed, compensating delete', { count: entryIds.length, err });
    const ph = entryIds.map(() => '?').join(',');
    await db.prepare(`DELETE FROM trip_entries WHERE id IN (${ph})`).bind(...entryIds).run();
    throw new AppError('SYS_DB_ERROR', 'entry 建立失敗，請稍後重試');
  }
  return entryIds;
}
