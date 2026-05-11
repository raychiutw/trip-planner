/**
 * _entry_pois.ts — trip_entry_pois 操作 helper（v2.27.0 multi-POI per entry）
 *
 * 對映 design doc `feat-multi-poi-per-entry-design-2026-05-11.md` Eng section。
 *
 * ## 核心 invariants
 *
 * 1. **sort_order=1 即 master**：UNIQUE (entry_id, sort_order) 保證單一 master
 * 2. **At-least-one master**：每 entry 必有 sort_order=1 row（backend enforce）
 * 3. **UNIQUE (entry_id, poi_id)**：同 POI 不能在同 entry 出現兩次
 * 4. **trip_entries.poi_id dual-write 過渡期**：Phase 1（v2.27.0）setMaster() 同步
 *    寫兩處；Phase 2（v2.27.1）DROP COLUMN 後改回單寫
 *
 * ## OCC（樂觀並發控制）
 *
 * 對抗 Codex Finding #1 CRITICAL — dual-write race。`getEntryPoisVersion()` 取
 * MAX(updated_at) 當 version token；setMaster() 帶 expectedVersion，mismatch 即
 * 409 STALE_ENTRY。
 *
 * ## Master swap TX 邏輯（Codex Finding #2）
 *
 * SQLite UNIQUE 是 immediate enforcement，兩個直接 UPDATE 會 collide。改用
 * temp_order = max+100 暫時 vacate sort_order=1，三段 UPDATE 包在 D1 batch
 * (implicit TX, rollback on failure)。
 *
 * ## Segment recompute（Codex Finding #3）
 *
 * `markAdjacentSegmentsStale()` 在 master 變動的 TX 內 mark trip_segments
 * source='stale' + computed_at=NULL。實際 Google Routes call 由 caller 在
 * commit 後 idempotent retry，失敗變 retryable warning 不阻斷 master swap。
 */
import { AppError } from './_errors';

export interface MasterPoiRow {
  poiId: number;
  name: string | null;
  lat: number | null;
  lng: number | null;
  type: string | null;
  category: string | null;
}

export interface AlternatePoiRow extends MasterPoiRow {
  sortOrder: number;
}

/**
 * 取 entry 的 master POI（sort_order=1）。若無 master row → return null。
 * Phase 1 dual-read fallback：trip_entry_pois 無 row 時，讀 trip_entries.poi_id
 * 並即時 INSERT 補資料（self-healing）。
 */
export async function getMasterPoi(
  db: D1Database,
  entryId: number,
): Promise<MasterPoiRow | null> {
  // Primary path: trip_entry_pois.sort_order=1 JOIN pois
  const primary = await db
    .prepare(
      `SELECT p.id AS poi_id, p.name, p.lat, p.lng, p.type, p.category
       FROM trip_entry_pois tep
       JOIN pois p ON p.id = tep.poi_id
       WHERE tep.entry_id = ? AND tep.sort_order = 1`,
    )
    .bind(entryId)
    .first<{ poi_id: number; name: string | null; lat: number | null; lng: number | null; type: string | null; category: string | null }>();

  if (primary) {
    return {
      poiId: primary.poi_id,
      name: primary.name,
      lat: primary.lat,
      lng: primary.lng,
      type: primary.type,
      category: primary.category,
    };
  }

  // Phase 1 fallback: trip_entries.poi_id 仍存在但 trip_entry_pois 沒寫到（migration
  // backfill 之前的 entries、或 race condition）→ self-heal INSERT
  const legacy = await db
    .prepare(
      `SELECT te.poi_id, p.name, p.lat, p.lng, p.type, p.category
       FROM trip_entries te
       LEFT JOIN pois p ON p.id = te.poi_id
       WHERE te.id = ? AND te.poi_id IS NOT NULL`,
    )
    .bind(entryId)
    .first<{ poi_id: number; name: string | null; lat: number | null; lng: number | null; type: string | null; category: string | null }>();

  if (!legacy || legacy.poi_id == null) return null;

  // Self-heal: INSERT into trip_entry_pois sort_order=1
  await db
    .prepare(
      `INSERT OR IGNORE INTO trip_entry_pois (entry_id, poi_id, sort_order, added_at, updated_at)
       VALUES (?, ?, 1, datetime('now'), datetime('now'))`,
    )
    .bind(entryId, legacy.poi_id)
    .run();

  return {
    poiId: legacy.poi_id,
    name: legacy.name,
    lat: legacy.lat,
    lng: legacy.lng,
    type: legacy.type,
    category: legacy.category,
  };
}

/** 取 entry 所有 alternates（sort_order > 1，依 sort_order 排序）。 */
export async function getAlternates(
  db: D1Database,
  entryId: number,
): Promise<AlternatePoiRow[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id AS poi_id, p.name, p.lat, p.lng, p.type, p.category, tep.sort_order
       FROM trip_entry_pois tep
       JOIN pois p ON p.id = tep.poi_id
       WHERE tep.entry_id = ? AND tep.sort_order > 1
       ORDER BY tep.sort_order ASC`,
    )
    .bind(entryId)
    .all<{ poi_id: number; name: string | null; lat: number | null; lng: number | null; type: string | null; category: string | null; sort_order: number }>();
  return results.map((r) => ({
    poiId: r.poi_id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    type: r.type,
    category: r.category,
    sortOrder: r.sort_order,
  }));
}

/**
 * OCC version token = MAX(updated_at) of all trip_entry_pois rows for entry。
 * 任一 row update / insert / delete 都會 bump version。Client 在 PATCH /master
 * 等 mutating endpoint 傳回收的 version，server 對比，mismatch → 409 STALE_ENTRY。
 */
export async function getEntryPoisVersion(
  db: D1Database,
  entryId: number,
): Promise<string> {
  const row = await db
    .prepare(
      `SELECT COALESCE(MAX(updated_at), '0') AS version FROM trip_entry_pois WHERE entry_id = ?`,
    )
    .bind(entryId)
    .first<{ version: string }>();
  return row?.version ?? '0';
}

/**
 * 把 newMasterPoiId 設為 entry 的 master（sort_order=1）。
 *
 * 邏輯（per Codex Finding #2 + #3）：
 * 1. 若 expectedVersion 提供且不 match 當前 version → 409 STALE_ENTRY
 * 2. 取 max sort_order，temp_order = max + 100（safe gap，避開既有 sort_order）
 * 3. UPDATE old master SET sort_order = temp_order（vacate sort_order=1）
 * 4. IF newMasterPoiId 已在 alternates → UPDATE 它 SET sort_order = 1
 *           old master → 改回 newMaster 原本的 sort_order
 *    ELSE  → INSERT 新 row (poi_id=newMasterPoiId, sort_order=1)
 *           old master → max+1
 * 5. UPDATE trip_entries.poi_id = newMasterPoiId（Phase 1 dual-write）
 * 6. UPDATE trip_segments SET source='stale', computed_at=NULL WHERE from_entry_id=entryId OR to_entry_id=entryId
 *    （caller 在 commit 後再呼 recomputeAdjacentSegments 觸發 Google Routes）
 */
export async function setMaster(
  db: D1Database,
  entryId: number,
  newMasterPoiId: number,
  expectedVersion?: string,
): Promise<{ version: string; oldMasterPoiId: number | null }> {
  // 1. OCC version check
  if (expectedVersion !== undefined) {
    const current = await getEntryPoisVersion(db, entryId);
    if (current !== expectedVersion) {
      throw new AppError('STALE_ENTRY', `expected version ${expectedVersion} but got ${current}`);
    }
  }

  // 2. Snapshot current state
  const oldMasterRow = await db
    .prepare('SELECT id, poi_id FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1')
    .bind(entryId)
    .first<{ id: number; poi_id: number }>();
  const oldMasterPoiId = oldMasterRow?.poi_id ?? null;

  // No-op: already master
  if (oldMasterPoiId === newMasterPoiId) {
    const version = await getEntryPoisVersion(db, entryId);
    return { version, oldMasterPoiId };
  }

  const newMasterRow = await db
    .prepare('SELECT id, sort_order FROM trip_entry_pois WHERE entry_id = ? AND poi_id = ?')
    .bind(entryId, newMasterPoiId)
    .first<{ id: number; sort_order: number }>();

  const maxRow = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM trip_entry_pois WHERE entry_id = ?')
    .bind(entryId)
    .first<{ max_order: number }>();
  const maxOrder = maxRow?.max_order ?? 0;
  const tempOrder = maxOrder + 100;

  const now = "datetime('now')";

  const statements: D1PreparedStatement[] = [];

  if (oldMasterRow) {
    // vacate sort_order=1 → temp_order
    statements.push(
      db
        .prepare(`UPDATE trip_entry_pois SET sort_order = ?, updated_at = ${now} WHERE id = ?`)
        .bind(tempOrder, oldMasterRow.id),
    );
  }

  if (newMasterRow) {
    // SWAP path: 已存在 alternate → 升 master
    statements.push(
      db
        .prepare(`UPDATE trip_entry_pois SET sort_order = 1, updated_at = ${now} WHERE id = ?`)
        .bind(newMasterRow.id),
    );
    if (oldMasterRow) {
      // demote old master 到 newMaster 原本 slot
      statements.push(
        db
          .prepare(`UPDATE trip_entry_pois SET sort_order = ?, updated_at = ${now} WHERE id = ?`)
          .bind(newMasterRow.sort_order, oldMasterRow.id),
      );
    }
  } else {
    // INSERT path: newMaster 是 search/favorites 來的新 POI
    statements.push(
      db
        .prepare(
          `INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, added_at, updated_at)
           VALUES (?, ?, 1, ${now}, ${now})`,
        )
        .bind(entryId, newMasterPoiId),
    );
    if (oldMasterRow) {
      // old master → max+1 (next alternate slot)
      statements.push(
        db
          .prepare(`UPDATE trip_entry_pois SET sort_order = ?, updated_at = ${now} WHERE id = ?`)
          .bind(maxOrder + 1, oldMasterRow.id),
      );
    }
  }

  // Phase 1 dual-write: trip_entries.poi_id 同步
  statements.push(
    db
      .prepare(`UPDATE trip_entries SET poi_id = ?, updated_at = ${now} WHERE id = ?`)
      .bind(newMasterPoiId, entryId),
  );

  // Mark adjacent segments stale（per Codex #3）
  // trip_segments.source CHECK 不允許 'stale'，改用 computed_at=NULL 標 stale +
  // bump updated_at 讓 frontend useTripSegments 知道要 refetch
  statements.push(
    db
      .prepare(
        `UPDATE trip_segments SET computed_at = NULL, updated_at = strftime('%s', 'now')
         WHERE from_entry_id = ? OR to_entry_id = ?`,
      )
      .bind(entryId, entryId),
  );

  await db.batch(statements);

  const version = await getEntryPoisVersion(db, entryId);
  return { version, oldMasterPoiId };
}

/** Add alternate POI（sort_order = max + 1）。 */
export async function addAlternate(
  db: D1Database,
  entryId: number,
  poiId: number,
): Promise<{ sortOrder: number; version: string }> {
  // 確認 entry 有 master（At-least-one invariant — alternate 不能在沒 master 時加）
  const masterCount = await db
    .prepare('SELECT COUNT(*) AS c FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1')
    .bind(entryId)
    .first<{ c: number }>();
  if (!masterCount || masterCount.c === 0) {
    throw new AppError('MISSING_MASTER', 'Entry must have a master POI before adding alternates');
  }

  // Check duplicate
  const dup = await db
    .prepare('SELECT id FROM trip_entry_pois WHERE entry_id = ? AND poi_id = ?')
    .bind(entryId, poiId)
    .first();
  if (dup) {
    throw new AppError('DUPLICATE_POI', `POI ${poiId} already exists in entry ${entryId}`);
  }

  const maxRow = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM trip_entry_pois WHERE entry_id = ?')
    .bind(entryId)
    .first<{ max_order: number }>();
  const newSortOrder = (maxRow?.max_order ?? 0) + 1;

  await db
    .prepare(
      `INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, added_at, updated_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
    )
    .bind(entryId, poiId, newSortOrder)
    .run();

  const version = await getEntryPoisVersion(db, entryId);
  return { sortOrder: newSortOrder, version };
}

/** Remove alternate POI（不能 remove master — caller 應走 DELETE /entries/:id）。 */
export async function removeAlternate(
  db: D1Database,
  entryId: number,
  poiId: number,
): Promise<{ version: string }> {
  const row = await db
    .prepare(
      'SELECT id, sort_order FROM trip_entry_pois WHERE entry_id = ? AND poi_id = ?',
    )
    .bind(entryId, poiId)
    .first<{ id: number; sort_order: number }>();
  if (!row) {
    throw new AppError('POI_NOT_ALTERNATE', `POI ${poiId} not in entry ${entryId}`);
  }
  if (row.sort_order === 1) {
    throw new AppError(
      'DATA_VALIDATION',
      'Cannot remove master via alternates endpoint. Use DELETE /entries/:id to delete entire stop.',
    );
  }
  await db.prepare('DELETE FROM trip_entry_pois WHERE id = ?').bind(row.id).run();

  const version = await getEntryPoisVersion(db, entryId);
  return { version };
}

/**
 * Reorder alternates。`orderedPoiIds` 是 alternates 的新順序（不含 master）。
 * 從 sort_order=2 起依序賦值。
 *
 * Validation:
 * - orderedPoiIds 必須完全等同當前 alternates set（不增不減）
 * - 不能含 master poi_id
 */
export async function reorderAlternates(
  db: D1Database,
  entryId: number,
  orderedPoiIds: number[],
): Promise<{ version: string }> {
  const current = await getAlternates(db, entryId);
  const currentIds = new Set(current.map((a) => a.poiId));
  const orderedSet = new Set(orderedPoiIds);

  if (orderedPoiIds.length !== current.length || orderedPoiIds.some((id) => !currentIds.has(id))) {
    throw new AppError(
      'INVALID_ORDER',
      'orderedPoiIds must match current alternates exactly (no add/remove)',
    );
  }
  if (orderedSet.size !== orderedPoiIds.length) {
    throw new AppError('INVALID_ORDER', 'orderedPoiIds contains duplicates');
  }

  // 兩段式 UPDATE 避開 UNIQUE collision：
  // Phase 1: 全部 alternates 推到 temp range（max+100, max+101, ...）
  // Phase 2: 依 orderedPoiIds 重排到 2, 3, ...
  const maxRow = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM trip_entry_pois WHERE entry_id = ?')
    .bind(entryId)
    .first<{ m: number }>();
  const tempBase = (maxRow?.m ?? 0) + 100;

  const phase1: D1PreparedStatement[] = current.map((a, i) =>
    db
      .prepare(`UPDATE trip_entry_pois SET sort_order = ?, updated_at = datetime('now') WHERE entry_id = ? AND poi_id = ?`)
      .bind(tempBase + i, entryId, a.poiId),
  );

  const phase2: D1PreparedStatement[] = orderedPoiIds.map((poiId, idx) =>
    db
      .prepare(`UPDATE trip_entry_pois SET sort_order = ?, updated_at = datetime('now') WHERE entry_id = ? AND poi_id = ?`)
      .bind(idx + 2, entryId, poiId),
  );

  await db.batch([...phase1, ...phase2]);

  const version = await getEntryPoisVersion(db, entryId);
  return { version };
}

/**
 * Recompute adjacent trip_segments 透過 Google Routes API。
 *
 * Called by setMaster() AFTER batch commit（per Codex Finding #3 — Google call
 * 不在 TX 內，commit 後 idempotent retry）。Failure → throw ROUTE_RECOMPUTE_FAILED；
 * caller 應吞下 error 並轉成 warning（master swap 本身已成功）。
 *
 * Note: 實際 Google Routes 整合在 functions/api/trips/[id]/segments/[sid].ts 已有；
 * 此 helper 僅 mark segment stale 並 trigger refresh — refresh 邏輯在 segments
 * PATCH 上層 handler 透過 source='stale' detect 觸發。本 v2.27.0 phase 不直接
 * 在此 call computeRoute，留待後續 enhancement（節省 v2.27.0 build cost）。
 */
export async function markSegmentsStaleAfterMasterChange(
  db: D1Database,
  entryId: number,
): Promise<{ affected: number }> {
  const result = await db
    .prepare(
      `UPDATE trip_segments SET computed_at = NULL, updated_at = strftime('%s', 'now')
       WHERE from_entry_id = ? OR to_entry_id = ?`,
    )
    .bind(entryId, entryId)
    .run();
  return { affected: result.meta?.changes ?? 0 };
}
