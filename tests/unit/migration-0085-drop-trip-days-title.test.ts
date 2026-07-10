// @vitest-environment node
/**
 * Migration 0085 — trip_days.title DROP COLUMN（每日 custom title 下線 Phase 2/2）。
 *
 * 純 DROP、無 backfill（title 是編輯 UI 從未實作、使用者不要的 dead 欄位）。
 * 共用 Miniflare D1（tests/api/setup.ts 會把全部 migration 含 0085 跑一次）直接驗 schema
 * ——這正是「套到 local D1 驗證欄位已消失」。與既有 migration schema test 同慣例（見 0078）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';

describe('migration 0085 — schema：trip_days.title 已 DROP（共用 DB，全 migration 已套）', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30000);

  afterAll(disposeMiniflare);

  it('trip_days 不再有 title 欄', async () => {
    const { results } = await db
      .prepare("PRAGMA table_info('trip_days')")
      .all<{ name: string }>();
    const names = results.map((r) => r.name);
    expect(names).not.toContain('title');
  });

  it('相鄰欄仍存在（label / day_num / date / hotel_poi_id）', async () => {
    const { results } = await db
      .prepare("PRAGMA table_info('trip_days')")
      .all<{ name: string }>();
    const names = results.map((r) => r.name);
    expect(names).toContain('label');
    expect(names).toContain('day_num');
    expect(names).toContain('date');
    expect(names).toContain('hotel_poi_id');
  });
});
