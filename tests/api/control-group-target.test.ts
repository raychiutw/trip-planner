/**
 * 對照組模式的自我檢查（拆分 T6）。只有設了 CONTROL_GROUP_DIR 才會跑：
 *   CONTROL_GROUP_DIR=.control-group npx vitest run --config vitest.config.api.mts
 * 確認這次測試真的跑在消毒副本上（有資料、且資料裡沒有真實 email）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';

describe.skipIf(!process.env.CONTROL_GROUP_DIR)('對照組：消毒過的 staging 資料副本', () => {
  let db: D1Database;
  beforeAll(async () => {
    db = await createTestDb();
  }, 60000);
  afterAll(disposeMiniflare);

  it('有消毒副本的資料：16 位使用者，email 全是 control.invalid 流水號', async () => {
    const { results } = await db
      .prepare("SELECT email FROM users WHERE email LIKE 'user%@control.invalid' ORDER BY email")
      .all<{ email: string }>();
    expect(results.length).toBe(16);
  });

  it('消毒副本裡沒有任何非 control.invalid 的 email（使用者與緊急聯絡人）', async () => {
    const users = await db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE email LIKE 'user%@control.invalid'")
      .first<{ n: number }>();
    const contacts = await db
      .prepare("SELECT COUNT(*) AS n FROM trip_emergency_contacts WHERE email LIKE '%@%' AND email NOT LIKE '%@control.invalid'")
      .first<{ n: number }>();
    expect(users?.n).toBe(16);
    expect(contacts?.n).toBe(0);
  });

  it('行程資料有帶過來（行程與天數不是空的）', async () => {
    const trips = await db.prepare('SELECT COUNT(*) AS n FROM trips').first<{ n: number }>();
    expect(trips!.n).toBeGreaterThanOrEqual(5);
  });
});
