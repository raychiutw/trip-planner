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
 * **trip_entries.updated_at** 當 version token（round 4 fix Codex F2：原本用
 * MAX(updated_at) FROM trip_entry_pois 在 removeAlternate 後可能 backward — 移除
 * max-ts row 後 MAX 變回更舊 ts，舊 token 重新有效）。所有 mutating helper
 * （setMaster / addAlternate / removeAlternate / reorderAlternates）都會 bump
 * trip_entries.updated_at = nowMs() 保證 monotonic。
 *
 * ## Master swap TX 邏輯（Codex Finding #2）
 *
 * SQLite UNIQUE 是 immediate enforcement，兩個直接 UPDATE 會 collide。改用
 * temp_order = max+100 暫時 vacate sort_order=1，三段 UPDATE 包在 D1 batch
 * (implicit TX, rollback on failure)。
 *
 * ## Segment recompute（Codex Finding #3）
 *
 * setMaster() 在 batch 內 mark trip_segments computed_at=NULL + updated_at=Date.now()
 * (ms — round 4 Codex F5 fix；原本用 strftime('%s') seconds 跟 recompute-travel
 * 的 Date.now() ms 不同 scale)。trip_segments.source CHECK 不允許 'stale'，所以
 * 只能用 computed_at=NULL signal。實際 Google Routes call 由 frontend useTripSegments
 * 在 computed_at=NULL detect 後觸發 POST /recompute-travel idempotent。
 */
import { AppError } from './_errors';

/** @internal — exported for syncEntryMaster collision-route to setMaster. */
export interface MasterPoiRow {
  poiId: number;
  name: string | null;
  lat: number | null;
  lng: number | null;
  type: string | null;
  category: string | null;
}

/** @internal — used inside reorderAlternates only. Do not call from endpoints. */
interface AlternatePoiRow extends MasterPoiRow {
  sortOrder: number;
}

/** 取 entry 所有 alternates（sort_order > 1，依 sort_order 排序）。 @internal */
async function getAlternates(
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
 * OCC version token = trip_entries.updated_at (monotonic by design — round 4 fix Codex F2).
 *
 * Previous impl used MAX(updated_at) FROM trip_entry_pois — backward-movable: when
 * removeAlternate deletes the row with the highest updated_at, MAX falls back to an
 * older timestamp, so stale tokens held by a racing client become valid again.
 *
 * trip_entries.updated_at avoids that: the row is never deleted during alt mutations,
 * and every mutating helper here bumps it = nowMs() (monotonically increasing JS clock).
 */
export async function getEntryPoisVersion(
  db: D1Database,
  entryId: number,
): Promise<string> {
  const row = await db
    .prepare(`SELECT updated_at AS version FROM trip_entries WHERE id = ?`)
    .bind(entryId)
    .first<{ version: string | null }>();
  return row?.version ?? '0';
}

/**
 * 產生 ISO 8601 millisecond-resolution timestamp 給 trip_entry_pois.updated_at。
 * SQLite `datetime('now')` 只有 1-second 解析度，會讓 sub-second 同 entry 的兩個
 * setMaster() OCC token 相同，race window 仍開放（Codex pre-landing CRITICAL #1）。
 * 改用 JS Date ISO（ms）+ 在 application layer bind 取代 SQL inline，全部時間源
 * 統一從同一個 JS 時鐘取，避免 batch 內 statement 各自呼叫 datetime('now')。
 */
function nowMs(): string {
  return new Date().toISOString();
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
 * 6. UPDATE trip_segments SET computed_at = NULL WHERE from_entry_id=entryId OR to_entry_id=entryId
 *    （只清 computed_at 不改 source — trip_segments.source CHECK 不允許 'stale'；
 *      frontend useTripSegments 透過 updated_at bump detect refetch；後續 Google Routes
 *      recompute 留待 v2.27.x enhancement）
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

  // 2. Snapshot current state — 3 SELECTs parallelized (round 4 perf P2 — D1 = network
  // round trip per query; serial cost was 3 RTs, now 1).
  const [oldMasterRow, newMasterRow, maxRow] = await Promise.all([
    db
      .prepare('SELECT id, poi_id FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1')
      .bind(entryId)
      .first<{ id: number; poi_id: number }>(),
    db
      .prepare('SELECT id, sort_order FROM trip_entry_pois WHERE entry_id = ? AND poi_id = ?')
      .bind(entryId, newMasterPoiId)
      .first<{ id: number; sort_order: number }>(),
    db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM trip_entry_pois WHERE entry_id = ?')
      .bind(entryId)
      .first<{ max_order: number }>(),
  ]);
  const oldMasterPoiId = oldMasterRow?.poi_id ?? null;
  const maxOrder = maxRow?.max_order ?? 0;
  const tempOrder = maxOrder + 100;

  // No-op: already master. Phase 1 drift safety (round 4 fix adv-C2) — still UPDATE
  // trip_entries.poi_id + bump updated_at so trip_entry_pois & trip_entries don't drift
  // when an earlier migration / race left them out of sync. We do NOT mark segments
  // stale (no plan change) and do NOT touch trip_entry_pois rows.
  if (oldMasterPoiId === newMasterPoiId) {
    const now = nowMs();
    await db
      .prepare('UPDATE trip_entries SET poi_id = ?, updated_at = ? WHERE id = ?')
      .bind(newMasterPoiId, now, entryId)
      .run();
    return { version: now, oldMasterPoiId };
  }

  // 統一 timestamp source — 整個 batch 內所有 updated_at 用同一個 JS-clock ISO ms
  // (Codex pre-landing CRITICAL #1 + HIGH #5)。所有 OCC token 來自此值。
  const now = nowMs();

  const statements: D1PreparedStatement[] = [];

  // OCC 策略：read-then-CAS via UNIQUE(entry_id, sort_order)。兩個並發 setMaster 都
  // 想寫 sort_order=1，UNIQUE constraint 讓 loser 失敗 → batch try/catch 抓
  // SQLITE_CONSTRAINT 轉成 STALE_ENTRY 409（Codex CRITICAL #3）。expectedVersion
  // 比對只是 happy path 短路 — 不傳 version 也安全，UNIQUE 仍會 catch race。
  if (oldMasterRow) {
    // vacate sort_order=1 → temp_order
    statements.push(
      db
        .prepare(`UPDATE trip_entry_pois SET sort_order = ?, updated_at = ? WHERE id = ?`)
        .bind(tempOrder, now, oldMasterRow.id),
    );
  }

  if (newMasterRow) {
    // SWAP path: 已存在 alternate → 升 master
    statements.push(
      db
        .prepare(`UPDATE trip_entry_pois SET sort_order = 1, updated_at = ? WHERE id = ?`)
        .bind(now, newMasterRow.id),
    );
    if (oldMasterRow) {
      // demote old master 到 newMaster 原本 slot
      statements.push(
        db
          .prepare(`UPDATE trip_entry_pois SET sort_order = ?, updated_at = ? WHERE id = ?`)
          .bind(newMasterRow.sort_order, now, oldMasterRow.id),
      );
    }
  } else {
    // INSERT path: newMaster 是 search/favorites 來的新 POI
    statements.push(
      db
        .prepare(
          `INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, added_at, updated_at)
           VALUES (?, ?, 1, ?, ?)`,
        )
        .bind(entryId, newMasterPoiId, now, now),
    );
    if (oldMasterRow) {
      // old master → max+1 (next alternate slot)
      statements.push(
        db
          .prepare(`UPDATE trip_entry_pois SET sort_order = ?, updated_at = ? WHERE id = ?`)
          .bind(maxOrder + 1, now, oldMasterRow.id),
      );
    }
  }

  // Phase 1 dual-write: trip_entries.poi_id 同步
  statements.push(
    db
      .prepare(`UPDATE trip_entries SET poi_id = ?, updated_at = ? WHERE id = ?`)
      .bind(newMasterPoiId, now, entryId),
  );

  // Mark adjacent segments stale（per Codex #3）
  // trip_segments.source CHECK 不允許 'stale'，改用 computed_at=NULL 標 stale +
  // bump updated_at 讓 frontend useTripSegments 知道要 refetch。
  // round 4 fix Codex F5: bind Date.now() ms (matches recompute-travel.ts:150
  // convention) instead of strftime('%s') seconds — mixing scales made the
  // "bumped updated_at" signal move backward when this UPDATE ran right after
  // a recompute, breaking refetch detection.
  const segUpdatedAt = Date.now();
  statements.push(
    db
      .prepare(
        `UPDATE trip_segments SET computed_at = NULL, updated_at = ?
         WHERE from_entry_id = ? OR to_entry_id = ?`,
      )
      .bind(segUpdatedAt, entryId, entryId),
  );

  try {
    await db.batch(statements);
  } catch (err) {
    // Codex pre-landing CRITICAL #3：並發 setMaster 走到 UNIQUE constraint
    // (entry_id, sort_order)=1 collision → catch + rethrow 為 STALE_ENTRY 給 client
    // proper 409 + retry hint，而非 opaque 500。SQL error 細節 log 到 console，
    // user-facing message 走 ERROR_MESSAGES catalog（避免 schema 名外漏 — Codex 2nd-pass）。
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint|SQLITE_CONSTRAINT/i.test(msg)) {
      console.warn('[setMaster] UNIQUE collision (concurrent master change)', msg);
      throw new AppError('STALE_ENTRY');
    }
    throw err;
  }

  // OCC version source is trip_entries.updated_at (round 4 fix Codex F2 — monotonic
  // by design). We just bumped it in the batch above, so use `now` directly to save
  // a SELECT round-trip (round 4 perf P4).
  return { version: now, oldMasterPoiId };
}

/** Add alternate POI（sort_order = max + 1）。 */
export async function addAlternate(
  db: D1Database,
  entryId: number,
  poiId: number,
  expectedVersion?: string,
): Promise<{ sortOrder: number; version: string }> {
  // OCC check (round 4 fix Codex F3 — alternates CRUD now uses same OCC as setMaster
  // so two concurrent reorders/adds can't silently overwrite each other).
  if (expectedVersion !== undefined) {
    const current = await getEntryPoisVersion(db, entryId);
    if (current !== expectedVersion) {
      throw new AppError('STALE_ENTRY', `expected version ${expectedVersion} but got ${current}`);
    }
  }

  // 三段平行 SELECT 同 setMaster 模式減 round-trip：master 存在 + dup-check + max
  const [masterCount, dup, maxRow] = await Promise.all([
    db
      .prepare('SELECT COUNT(*) AS c FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1')
      .bind(entryId)
      .first<{ c: number }>(),
    db
      .prepare('SELECT id FROM trip_entry_pois WHERE entry_id = ? AND poi_id = ?')
      .bind(entryId, poiId)
      .first(),
    db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM trip_entry_pois WHERE entry_id = ?')
      .bind(entryId)
      .first<{ max_order: number }>(),
  ]);

  // At-least-one invariant: alternate 不能在沒 master 時加
  if (!masterCount || masterCount.c === 0) {
    throw new AppError('MISSING_MASTER', 'Entry must have a master POI before adding alternates');
  }
  if (dup) {
    throw new AppError('DUPLICATE_POI', `POI ${poiId} already exists in entry ${entryId}`);
  }

  const newSortOrder = (maxRow?.max_order ?? 0) + 1;
  const now = nowMs();

  // 同 setMaster CRITICAL #3：兩個並發 addAlternate 讀到同 max → 同 sort_order INSERT
  // → UNIQUE(entry_id, sort_order) collision；catch 後轉成 retryable STALE_ENTRY，
  // client 重抓 version 後再試。UNIQUE(entry_id, poi_id) 衝突也走同一 catch，但語意
  // 上是 DUPLICATE_POI（並發 add 同一 POI）— 我們已 dup-check 過，剩 race window 很窄。
  // round 4 fix F2: also bump trip_entries.updated_at to make OCC token monotonic.
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, added_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(entryId, poiId, newSortOrder, now, now),
      db
        .prepare('UPDATE trip_entries SET updated_at = ? WHERE id = ?')
        .bind(now, entryId),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint|SQLITE_CONSTRAINT/i.test(msg)) {
      throw new AppError('STALE_ENTRY', 'concurrent alternate add detected — retry after refreshing version');
    }
    throw err;
  }

  return { sortOrder: newSortOrder, version: now };
}

/** Remove alternate POI（不能 remove master — caller 應走 DELETE /entries/:id）。 */
export async function removeAlternate(
  db: D1Database,
  entryId: number,
  poiId: number,
  expectedVersion?: string,
): Promise<{ version: string }> {
  // OCC check (round 4 fix F3)
  if (expectedVersion !== undefined) {
    const current = await getEntryPoisVersion(db, entryId);
    if (current !== expectedVersion) {
      throw new AppError('STALE_ENTRY', `expected version ${expectedVersion} but got ${current}`);
    }
  }

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

  // Batch DELETE + trip_entries.updated_at bump so OCC token is monotonic (round 4 F2).
  const now = nowMs();
  await db.batch([
    db.prepare('DELETE FROM trip_entry_pois WHERE id = ?').bind(row.id),
    db.prepare('UPDATE trip_entries SET updated_at = ? WHERE id = ?').bind(now, entryId),
  ]);

  return { version: now };
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
  expectedVersion?: string,
): Promise<{ version: string }> {
  // OCC check (round 4 fix F3 — was missing entirely, two concurrent reorders silently
  // overwrote each other).
  if (expectedVersion !== undefined) {
    const current = await getEntryPoisVersion(db, entryId);
    if (current !== expectedVersion) {
      throw new AppError('STALE_ENTRY', `expected version ${expectedVersion} but got ${current}`);
    }
  }

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
  //
  // round 4 perf P7: max sort_order derived from getAlternates result (ASC ordered,
  // last element is the max alternate) — saves a redundant SELECT MAX round-trip.
  // Master holds sort_order=1, alternates start at 2 — so masterOrder+1 < altMaxOrder
  // always, and max(alternates) is enough since temp range only needs to exceed alts.
  const altMaxOrder = current.length > 0 ? current[current.length - 1]!.sortOrder : 1;
  const tempBase = altMaxOrder + 100;

  const now = nowMs();
  const phase1: D1PreparedStatement[] = current.map((a, i) =>
    db
      .prepare(`UPDATE trip_entry_pois SET sort_order = ?, updated_at = ? WHERE entry_id = ? AND poi_id = ?`)
      .bind(tempBase + i, now, entryId, a.poiId),
  );

  const phase2: D1PreparedStatement[] = orderedPoiIds.map((poiId, idx) =>
    db
      .prepare(`UPDATE trip_entry_pois SET sort_order = ?, updated_at = ? WHERE entry_id = ? AND poi_id = ?`)
      .bind(idx + 2, now, entryId, poiId),
  );

  // round 4 fix F2: bump trip_entries.updated_at for monotonic OCC token
  const bump = db.prepare('UPDATE trip_entries SET updated_at = ? WHERE id = ?').bind(now, entryId);

  await db.batch([...phase1, ...phase2, bump]);

  return { version: now };
}

/**
 * 確保 trip_entry_pois 對 entry_id 有 sort_order=1 row（v2.27.0 multi-POI invariant）。
 * 給 entry-create 路徑（POST /entries / PUT /days/:num / copy）在 INSERT/UPDATE
 * trip_entries.poi_id 之後立刻呼叫，避免「entry 建好後 addAlternate MISSING_MASTER」
 * 的 bug（Codex pre-landing CRITICAL #2）。
 *
 * 行為：
 *   - 若 trip_entry_pois 已有 sort_order=1 且 poi_id 相同 → no-op
 *   - 若 trip_entry_pois 已有 sort_order=1 但 poi_id 不同 → UPDATE 改 poi_id（這是 master swap，
 *     正規路徑應走 setMaster() 含 segments 更新；此 helper 只供 entry-create 場景，假設沒
 *     existing master row，所以直接 UPDATE 也安全）
 *   - 若無 sort_order=1 row → INSERT
 *
 * @param db D1
 * @param entryId 已存在的 trip_entries.id
 * @param poiId 對應的 pois.id (NOT NULL)
 */
export async function syncEntryMaster(
  db: D1Database,
  entryId: number,
  poiId: number,
): Promise<void> {
  const now = nowMs();
  // INSERT OR REPLACE on UNIQUE(entry_id, sort_order) 會 swap 既有 sort_order=1 row
  // 但 UNIQUE(entry_id, poi_id) 可能讓「同 POI 已存在當 alternate」的場景失敗。
  // 安全做法：先 SELECT 既有 sort_order=1 → 不存在則 INSERT；存在 + 不同 POI 則需要
  // master↔alternate swap，路由到 setMaster (round 4 fix adv-C4 — naked UPDATE blew up
  // on UNIQUE(entry_id, poi_id) when new poiId was already an alternate of this entry).
  const [existing, asAlternate] = await Promise.all([
    db
      .prepare('SELECT id, poi_id FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1')
      .bind(entryId)
      .first<{ id: number; poi_id: number }>(),
    db
      .prepare('SELECT id FROM trip_entry_pois WHERE entry_id = ? AND poi_id = ? AND sort_order > 1')
      .bind(entryId, poiId)
      .first<{ id: number }>(),
  ]);

  if (!existing) {
    await db
      .prepare(
        `INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, added_at, updated_at)
         VALUES (?, ?, 1, ?, ?)`,
      )
      .bind(entryId, poiId, now, now)
      .run();
    return;
  }

  if (existing.poi_id === poiId) {
    // poi_id 相同 → no-op
    return;
  }

  if (asAlternate) {
    // poiId 已是這個 entry 的 alternate → naked UPDATE 會撞 UNIQUE(entry_id, poi_id)。
    // 走 setMaster 做 master↔alternate swap，連帶 dual-write + segments stale 一起處理。
    await setMaster(db, entryId, poiId);
    return;
  }

  // existing master poi_id != poiId, and poiId is not yet an alternate → safe UPDATE
  await db
    .prepare('UPDATE trip_entry_pois SET poi_id = ?, updated_at = ? WHERE id = ?')
    .bind(poiId, now, existing.id)
    .run();
}
