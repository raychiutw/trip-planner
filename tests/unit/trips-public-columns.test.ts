// @vitest-environment node
/**
 * 匿名可讀的行程資料表欄位白名單。
 *
 * GET /api/trips/:id、/days、/days/:num 對「已發布」行程允許匿名讀取，且用 `SELECT *`
 * （functions/api/trips/[id].ts、days.ts、days/[num].ts）。`SELECT *` 的意思是：之後只要在這些表
 * 加一個欄位，它就**自動**對匿名讀者公開 —— 不管那個欄位是不是該公開。
 *
 * 隱私模型見 docs/adr/0008-published-trips-are-fully-public.md（已發布行程本體對匿名讀者全公開）。
 * 2026-10-09 盤點：現有欄位全數可公開（owner_user_id／title／countries 等列表端本來就對匿名回；
 * 其餘是行程文字與時間戳；沒有 email、token）。這個測試把盤點結果鎖住：新增欄位會紅，
 * 迫使當下決定「這欄要不要給匿名讀者」，而不是靜默公開。
 * 若是要公開 → 加進白名單；若不該公開 → 把對應端點的 SELECT * 改成明確欄位列表。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';

const PUBLIC_COLUMNS: Record<string, string[]> = {
  trips: ['id', 'name', 'owner_user_id', 'title', 'description', 'countries', 'published', 'data_source', 'lang', 'created_at', 'updated_at', 'archived_at'],
  trip_days: ['id', 'trip_id', 'day_num', 'date', 'day_of_week', 'label', 'updated_at', 'hotel_poi_id', 'version'],
  // days／[num] 對匿名讀者另會 SELECT * FROM pois（hotel／parking POI；pois 是跨行程共用的店家主檔，CONTEXT：行程私有文字不進 pois）
  pois: ['id', 'type', 'name', 'description', 'note', 'address', 'phone', 'email', 'website', 'hours', 'rating', 'category', 'lat', 'lng', 'country', 'source', 'created_at', 'updated_at', 'osm_id', 'osm_type', 'wikidata_id', 'cuisine', 'data_source', 'data_fetched_at', 'place_id', 'status', 'status_reason', 'status_checked_at', 'last_refreshed_at', 'price'],
  trip_entries: ['id', 'day_id', 'sort_order', 'description', 'source', 'updated_at', 'order_in_day', 'start_time', 'end_time', 'entry_pois_version', 'version'],
};

let db: D1Database;
beforeAll(async () => { db = await createTestDb(); });
afterAll(async () => { await disposeMiniflare(); });

describe('匿名可讀表格的欄位白名單（SELECT * 的防線）', () => {
  for (const [table, expected] of Object.entries(PUBLIC_COLUMNS)) {
    it(`${table}：欄位集合與白名單一致`, async () => {
      const cols = ((await db.prepare(`PRAGMA table_info(${table})`).all()).results as Array<{ name: string }>).map((c) => c.name);
      expect(cols.sort(), `${table} 新增／移除了欄位：請決定是否對匿名讀者公開（見檔頭說明）`).toEqual([...expected].sort());
    });
  }
});
