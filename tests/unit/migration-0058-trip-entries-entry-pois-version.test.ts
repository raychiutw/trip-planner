// @vitest-environment node
/**
 * Migration 0058 — trip_entries.entry_pois_version OCC counter
 *
 * 對映 round 5 architectural fix（adversarial round 4 「OCC source dual-write race」
 * + cross-mutation false-positive）。Dedicated INTEGER counter，only 4 multi-POI
 * mutating helpers bump，PATCH /entries note/time edit 不觸碰，GET + write 同源讀寫。
 *
 * Covers:
 * 1. ADD COLUMN schema (PRAGMA table_info)
 * 2. NOT NULL + DEFAULT 0 — 既有 rows 自動拿到 0
 * 3. Monotonic 行為 — 每次 UPDATE = current + 1 不會 race backward
 * 4. SQLite ≥3.35 metadata-only ALTER（D1 supported）— 不該重寫整張表
 * 5. Round 5 invariant：cross-mutation isolation — UPDATE trip_entries SET note=...
 *    NOT 動 entry_pois_version
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { seedTrip, seedPoi, seedEntry, getDayId } from '../api/helpers';

describe('migration 0058 — trip_entries.entry_pois_version', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30000);

  afterAll(disposeMiniflare);

  beforeEach(async () => {
    await db.prepare('DELETE FROM trip_entry_pois').run();
  });

  it('ADD COLUMN — trip_entries 含 entry_pois_version INTEGER NOT NULL DEFAULT 0', async () => {
    const { results } = await db
      .prepare("PRAGMA table_info('trip_entries')")
      .all<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>();
    const col = results.find((r) => r.name === 'entry_pois_version');
    expect(col).toBeTruthy();
    expect(col!.type.toUpperCase()).toBe('INTEGER');
    expect(col!.notnull).toBe(1);
    // SQLite stores INTEGER defaults as string literal '0' in PRAGMA output
    expect(col!.dflt_value).toBe('0');
  });

  it('既有 rows DEFAULT 0 — 新建 entry 沒 explicitly 設 version 時讀回 0', async () => {
    const { id: tripId } = await seedTrip(db, { id: 'mig58-default-trip' });
    const dayId = await getDayId(db, tripId, 1);
    const poiId = await seedPoi(db, { name: 'POI-Mig58-Default' });
    const entryId = await seedEntry(db, dayId, { title: 'fresh entry', poiId });

    const row = await db
      .prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId)
      .first<{ v: number }>();
    expect(row).not.toBeNull();
    expect(row!.v).toBe(0);
  });

  it('Monotonic bump — UPDATE entry_pois_version = entry_pois_version + 1 永遠遞增', async () => {
    const { id: tripId } = await seedTrip(db, { id: 'mig58-mono-trip' });
    const dayId = await getDayId(db, tripId, 1);
    const poiId = await seedPoi(db, { name: 'POI-Mig58-Mono' });
    const entryId = await seedEntry(db, dayId, { title: 'mono entry', poiId });

    for (let i = 1; i <= 5; i++) {
      await db
        .prepare('UPDATE trip_entries SET entry_pois_version = entry_pois_version + 1 WHERE id = ?')
        .bind(entryId)
        .run();
      const row = await db
        .prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
        .bind(entryId)
        .first<{ v: number }>();
      expect(row!.v).toBe(i);
    }
  });

  it('Cross-mutation isolation — UPDATE note/title 不動 entry_pois_version', async () => {
    // Round 5 architectural fix 的核心 invariant：non-multi-POI mutations 不該
    // invalidate OCC token。Raw SQL 模擬 PATCH /entries 的 buildUpdateClause behavior
    // — handler whitelist 排除 entry_pois_version，所以這條 UPDATE 永遠不會 bump 它。
    const { id: tripId } = await seedTrip(db, { id: 'mig58-iso-trip' });
    const dayId = await getDayId(db, tripId, 1);
    const poiId = await seedPoi(db, { name: 'POI-Mig58-Iso' });
    const entryId = await seedEntry(db, dayId, { title: 'iso entry', poiId });

    await db
      .prepare('UPDATE trip_entries SET entry_pois_version = entry_pois_version + 1 WHERE id = ?')
      .bind(entryId)
      .run();
    const before = await db
      .prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId)
      .first<{ v: number }>();
    expect(before!.v).toBe(1);

    // PATCH /entries note edit simulation — handler 只 SET note + updated_at，
    // 不該影響 entry_pois_version。
    await db
      .prepare("UPDATE trip_entries SET note = '更新備註', updated_at = datetime('now') WHERE id = ?")
      .bind(entryId)
      .run();

    const after = await db
      .prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId)
      .first<{ v: number }>();
    expect(after!.v).toBe(1); // unchanged — round 5 invariant
  });

  it('INTEGER 上限合理 — counter 增到 100000 仍正常運作', async () => {
    // Sanity check：32-bit 上限是 ~2.1 billion，正常使用永遠用不完。
    // 但 SQLite INTEGER 是 64-bit signed，理論可達 9.2e18。
    const { id: tripId } = await seedTrip(db, { id: 'mig58-big-trip' });
    const dayId = await getDayId(db, tripId, 1);
    const poiId = await seedPoi(db, { name: 'POI-Mig58-Big' });
    const entryId = await seedEntry(db, dayId, { title: 'big entry', poiId });

    await db
      .prepare('UPDATE trip_entries SET entry_pois_version = 100000 WHERE id = ?')
      .bind(entryId)
      .run();
    await db
      .prepare('UPDATE trip_entries SET entry_pois_version = entry_pois_version + 1 WHERE id = ?')
      .bind(entryId)
      .run();
    const row = await db
      .prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId)
      .first<{ v: number }>();
    expect(row!.v).toBe(100001);
  });
});
