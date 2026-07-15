// @vitest-environment node
/**
 * Migration 0086 — pois.photos DROP COLUMN（POI 照片功能移除）。
 *
 * 純 DROP、無 backfill：0038 規劃的 Wikimedia backfill script 從未存在，且從來沒有
 * 任何寫入路徑（`functions/api/pois/[id].ts` 的 ALLOWED_FIELDS 不含 photos），
 * 所以這欄恆為 NULL、與 POI 筆數無關。
 * 共用 Miniflare D1（tests/api/setup.ts 會把全部 migration 含 0086 跑一次）直接驗 schema
 * ——這正是「套到 local D1 驗證欄位已消失」。與既有 migration schema test 同慣例（見 0078 / 0085）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';

describe('migration 0086 — schema：pois.photos 已 DROP（共用 DB，全 migration 已套）', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30000);

  afterAll(disposeMiniflare);

  it('pois 不再有 photos 欄', async () => {
    const { results } = await db
      .prepare("PRAGMA table_info('pois')")
      .all<{ name: string }>();
    const names = results.map((r) => r.name);
    expect(names).not.toContain('photos');
  });

  it('相鄰欄仍存在（price / rating / place_id / category / type）', async () => {
    const { results } = await db
      .prepare("PRAGMA table_info('pois')")
      .all<{ name: string }>();
    const names = results.map((r) => r.name);
    expect(names).toContain('price');
    expect(names).toContain('rating');
    expect(names).toContain('place_id');
    expect(names).toContain('category');
    expect(names).toContain('type');
  });
});
