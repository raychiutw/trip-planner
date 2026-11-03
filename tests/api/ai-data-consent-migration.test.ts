/**
 * migrations/0101_ai_data_consent_events.sql 及其 rollback 的行為守門（spec #1553、ADR-0012）。
 *
 * Value: protects=事件只接受 accepted／withdrawn、使用者不存在不可寫入、刪帳號連動清掉該人的事件、(user_id,id) 索引存在、rollback 能乾淨移除且重跑 forward 可還原; fails_when=拿掉 CHECK／FK／ON DELETE CASCADE／索引、rollback 漏刪索引或表; why_new=ai-data-consent.test.ts 只經 HTTP 驗行為，不驗 migration 檔本身; seam=none; no_claim=prod D1 的實際套用（見部署順序）
 * 共用 D1：資料列用 mig0101- 前綴並在 finally 清掉；rollback 測試結束前一定重跑 forward 還原。
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';

const ROOT = path.join(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const FORWARD = read('migrations/0101_ai_data_consent_events.sql');
const ROLLBACK = read('migrations/rollback/0101_ai_data_consent_events_rollback.sql');

let db: D1Database;
beforeAll(async () => { db = await createTestDb(); }, 30000);
afterAll(disposeMiniflare);

const runSql = async (sql: string) => {
  for (const stmt of sql.replace(/--[^\n]*/g, '').split(';').map((x) => x.trim()).filter(Boolean)) await db.prepare(stmt).run();
};
const addUser = (id: string) => db.prepare('INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)').bind(id, `${id}@t.com`, id).run();
const event = (userId: string, version: string | null, ev: string) =>
  db.prepare('INSERT INTO ai_data_consent_events (user_id, version, event) VALUES (?, ?, ?)').bind(userId, version, ev).run();
const cleanup = async () => {
  await db.prepare("DELETE FROM users WHERE id LIKE 'mig0101-%'").run(); // CASCADE 一併清事件
  await db.prepare("DELETE FROM ai_data_consent_events WHERE user_id LIKE 'mig0101-%'").run();
};
const tableExists = async () =>
  (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_data_consent_events'").first()) !== null;

describe('0101 ai_data_consent_events', () => {
  it('寫入後有遞增 id 與 UTC ISO created_at；event 只接受 accepted／withdrawn', async () => {
    try {
      await addUser('mig0101-u1');
      await event('mig0101-u1', 'ai-data-v1', 'accepted');
      await event('mig0101-u1', 'ai-data-v1', 'withdrawn');
      const rows = (await db.prepare("SELECT id, event, created_at FROM ai_data_consent_events WHERE user_id = 'mig0101-u1' ORDER BY id").all<{ id: number; event: string; created_at: string }>()).results;
      expect(rows.map((r) => r.event)).toEqual(['accepted', 'withdrawn']);
      expect(rows[1]!.id).toBeGreaterThan(rows[0]!.id);
      expect(rows[0]!.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      await expect(event('mig0101-u1', 'ai-data-v1', 'revoked')).rejects.toThrow();
    } finally { await cleanup(); }
  });

  it('version 不可為 NULL；使用者不存在不可寫入', async () => {
    try {
      await expect(event('mig0101-ghost', 'ai-data-v1', 'accepted')).rejects.toThrow();
      await addUser('mig0101-u2');
      await expect(event('mig0101-u2', null, 'accepted')).rejects.toThrow();
    } finally { await cleanup(); }
  });

  it('刪除使用者（帳號刪除）會連動清掉該人的事件，別人的不受影響', async () => {
    try {
      await addUser('mig0101-u3'); await addUser('mig0101-u4');
      await event('mig0101-u3', 'ai-data-v1', 'accepted');
      await event('mig0101-u4', 'ai-data-v1', 'accepted');
      await db.prepare("DELETE FROM users WHERE id = 'mig0101-u3'").run();
      const left = (await db.prepare("SELECT user_id FROM ai_data_consent_events WHERE user_id LIKE 'mig0101-%'").all<{ user_id: string }>()).results;
      expect(left).toEqual([{ user_id: 'mig0101-u4' }]);
    } finally { await cleanup(); }
  });

  it('有 (user_id, id) 索引（查最新事件用）', async () => {
    const idx = (await db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ai_data_consent_events'").all<{ name: string }>()).results;
    expect(idx.map((i) => i.name)).toContain('idx_ai_data_consent_user_id');
  });

  it('rollback：移除表與索引；重跑 forward 可還原（結束前一定還原，避免影響共用 D1 的其他測試）', async () => {
    try {
      expect(await tableExists()).toBe(true);
      await runSql(ROLLBACK);
      expect(await tableExists()).toBe(false);
      const idx = (await db.prepare("SELECT name FROM sqlite_master WHERE name = 'idx_ai_data_consent_user_id'").all()).results;
      expect(idx).toEqual([]);
      await runSql(ROLLBACK); // 重跑冪等（IF EXISTS）
    } finally {
      if (!(await tableExists())) await runSql(FORWARD);
    }
    expect(await tableExists()).toBe(true);
  });
});
