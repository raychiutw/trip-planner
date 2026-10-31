/**
 * 帳號抹除對 oauth_models 的刪除不得整表掃描。
 * 用 EXPLAIN QUERY PLAN 看真正使用的那條 SQL（OAUTH_MODELS_ERASE_SQL）：每個條件都要走索引。
 * 沒有 `$.user_id` 的表達式索引時，OR 會讓整條退化成整表掃描，每次刪帳號都解析所有列的 JSON。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { OAUTH_MODELS_ERASE_SQL } from '../../functions/api/_erasure';

describe('抹除 oauth_models 的查詢計畫', () => {
  let db: D1Database;
  beforeAll(async () => { db = await createTestDb(); }, 60000);
  afterAll(disposeMiniflare);

  const plan = async (sql: string) => {
    const { results } = await db.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind('u', 'u').all<{ detail: string }>();
    return results.map((r) => r.detail);
  };

  it('正式使用的刪除語句不含整表掃描（SCAN oauth_models）', async () => {
    const details = await plan(OAUTH_MODELS_ERASE_SQL);
    expect(details.filter((d) => /SCAN/i.test(d)), `查詢計畫：\n${details.join('\n')}`).toEqual([]);
  });

  it('兩個條件各自用到索引：$.user_id 與 $.uid', async () => {
    const details = (await plan(OAUTH_MODELS_ERASE_SQL)).join('\n');
    expect(details).toMatch(/idx_oauth_models_user_id/);
    expect(details).toMatch(/idx_oauth_models_uid/);
  });
});
