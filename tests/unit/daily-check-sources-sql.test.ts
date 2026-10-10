// @vitest-environment node
/**
 * daily-check 的 D1 來源：用**真實 migration schema**（Miniflare D1）執行它實際送出的 SQL。
 *
 * 取代三個 grep 原始碼的測試（audit-anomaly、hygiene-note-cutover、npm-audit-timeout）：
 * 它們鎖的是 SQL 的拼字，換個寫法同義就紅、語意壞了字串還在卻綠。真正要守的契約是
 * 「這條 SQL 在現行 schema 上能跑（不會 no such column）、門檻與狀態分類正確」——直接跑就知道。
 * 介面是既有的 seam：createCheckSources({ queryD1, execSync, ... }).<來源>.run()。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createTestDb, disposeMiniflare } from '../api/setup';

const require_ = createRequire(import.meta.url);
const { createCheckSources } = require_('../../scripts/daily-check.js');

let db: D1Database;
const queryD1 = async (sql: string) => (await db.prepare(sql).all()).results;
const sources = () => createCheckSources({ queryD1, env: {} });

beforeAll(async () => {
  db = await createTestDb();
  await db.prepare(`INSERT OR IGNORE INTO users (id, email, display_name, status) VALUES ('u-dc', 'dc@example.com', 'dc', 'active')`).run();
});
afterAll(async () => {
  // 共用 Miniflare DB：不留資料給同一個 worker 內的其他測試檔
  await db.prepare('DELETE FROM audit_log').run();
  await db.prepare(`DELETE FROM trips WHERE id = 't-hyg'`).run();
  await db.prepare(`DELETE FROM pois WHERE name IN ('hyg-p1','hyg-p2')`).run();   // 斷言失敗時 test body 內的清理不會跑
  await db.prepare(`DELETE FROM users WHERE id = 'u-dc' OR id LIKE 'u-lim-%'`).run();
  await disposeMiniflare();
});

describe('auditAnomaly（真實 schema）', () => {
  beforeEach(async () => { await db.prepare('DELETE FROM audit_log').run(); });

  async function addAudit(n: number, o: { trip?: string; table?: string; action?: string; userId?: string | null; daysAgo?: number; ago?: string }) {
    const stmt = db.prepare(
      `INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, changed_by_user_id, created_at)
       VALUES (?, ?, 1, ?, 'x', ?, datetime('now', ?))`,
    );
    const ago = o.ago ?? `-${o.daysAgo ?? 0} day`;
    const batch = Array.from({ length: n }, () => stmt.bind(o.trip ?? 't-1', o.table ?? 'trip_entries', o.action ?? 'update', o.userId === undefined ? 'u-dc' : o.userId, ago));
    await db.batch(batch);
  }

  it('沒有資料 → ok，並帶出門檻供報告顯示', async () => {
    const r = await sources().auditAnomaly.run();
    expect(r.status).toBe('ok');
    expect(r.thresholds).toEqual({ userMutationWarning: 200, tripMutationWarning: 100, deleteCritical: 10 });
  });

  it('單一使用者 24h 內 mutation 超過 200 → warning；剛好 200 不算', async () => {
    await addAudit(200, { trip: 'system' });   // system trip 不計入 trip 門檻
    expect((await sources().auditAnomaly.run()).status).toBe('ok');
    await addAudit(1, { trip: 'system' });
    const r = await sources().auditAnomaly.run();
    expect(r.status).toBe('warning');
    expect(r.heavyUsers).toHaveLength(1);
    expect(r.heavyTrips).toHaveLength(0);
  });

  it('單一 trip 24h 內超過 100 筆 → warning（service token 無 user id 也算）', async () => {
    await addAudit(101, { trip: 't-heavy', userId: null });
    const r = await sources().auditAnomaly.run();
    expect(r.status).toBe('warning');
    expect(r.heavyTrips.map((t: { tripId: string }) => t.tripId)).toEqual(['t-heavy']);
  });

  it('trips 表的 delete 超過 10 → critical', async () => {
    await addAudit(11, { table: 'trips', action: 'delete', trip: 't-del' });
    expect((await sources().auditAnomaly.run()).status).toBe('critical');
  });

  it('users 表的 delete 超過 10 也是 critical；剛好 10 不算', async () => {
    await addAudit(10, { table: 'users', action: 'delete', trip: 'system' });
    expect((await sources().auditAnomaly.run()).status).toBe('ok');
    await addAudit(1, { table: 'users', action: 'delete', trip: 'system' });
    expect((await sources().auditAnomaly.run()).status).toBe('critical');
  });

  it('heavyTrips 最多回 10 筆（LIMIT 10，避免報告爆量）', async () => {
    for (let i = 0; i < 12; i++) await addAudit(101, { trip: `t-lim-${i}`, userId: null });
    const r = await sources().auditAnomaly.run();
    expect(r.heavyTrips).toHaveLength(10);
  }, 90_000);   // 約 1.2k 單筆 insert；config 註解提過負載下 Miniflare 可慢 10 倍

  it('trip 門檻是「大於 100」：剛好 100 筆不算，101 才 warning', async () => {
    await addAudit(100, { trip: 't-edge', userId: null });
    expect((await sources().auditAnomaly.run()).status).toBe('ok');
    await addAudit(1, { trip: 't-edge', userId: null });
    expect((await sources().auditAnomaly.run()).status).toBe('warning');
  });

  it('critical 優先於 warning：同時有重度使用者與 trips delete 爆量 → critical，且 heavyUsers 仍帶出', async () => {
    await addAudit(201, { trip: 'system' });
    await addAudit(11, { table: 'trips', action: 'delete', trip: 'system' });
    const r = await sources().auditAnomaly.run();
    expect(r.status).toBe('critical');
    expect(r.heavyUsers).toHaveLength(1);
  });

  it('只有 delete 才算 critical：trips／users 表的 insert／update 再多也不觸發', async () => {
    await addAudit(11, { table: 'trips', action: 'update', trip: 'system', userId: null });
    await addAudit(11, { table: 'users', action: 'insert', trip: 'system', userId: null });
    expect((await sources().auditAnomaly.run()).status).toBe('ok');
  });

  it('24 小時窗口的兩側：23 小時前的算、25 小時前的不算', async () => {
    await addAudit(101, { trip: 't-old', userId: null, ago: '-25 hours' });
    expect((await sources().auditAnomaly.run()).status).toBe('ok');
    await addAudit(101, { trip: 't-new', userId: null, ago: '-23 hours' });
    const r = await sources().auditAnomaly.run();
    expect(r.status).toBe('warning');
    expect(r.heavyTrips.map((t: { tripId: string }) => t.tripId)).toEqual(['t-new']);
  });

  it('heavyUsers 最多回 10 筆；沒有 user id 的紀錄（service token）不算進使用者門檻', async () => {
    for (let i = 0; i < 12; i++) {
      await db.prepare(`INSERT OR IGNORE INTO users (id, email, display_name, status) VALUES (?, ?, 'x', 'active')`).bind(`u-lim-${i}`, `lim${i}@example.com`).run();
      await addAudit(201, { trip: 'system', userId: `u-lim-${i}` });
    }
    expect((await sources().auditAnomaly.run()).heavyUsers).toHaveLength(10);
    await db.prepare('DELETE FROM audit_log').run();
    await addAudit(201, { trip: 'system', userId: null });
    const r = await sources().auditAnomaly.run();
    expect(r.heavyUsers).toHaveLength(0);
    expect(r.status).toBe('ok');
  }, 90_000);   // 約 2.4k 單筆 insert（12 位使用者 × 201）

  it('delete 的 critical 偵測也只看 24 小時內：一天多以前的 trips 刪除不計入', async () => {
    await addAudit(11, { table: 'trips', action: 'delete', trip: 'system', userId: null, ago: '-25 hours' });
    expect((await sources().auditAnomaly.run()).status).toBe('ok');
    await addAudit(1, { table: 'trips', action: 'delete', trip: 'system', userId: null, ago: '-23 hours' });
    await addAudit(10, { table: 'trips', action: 'delete', trip: 'system', userId: null, ago: '-23 hours' });
    expect((await sources().auditAnomaly.run()).status).toBe('critical');
  });

  it('其他表的 delete 不觸發 critical；超過 24 小時的紀錄不計入', async () => {
    await addAudit(50, { table: 'trip_entries', action: 'delete' });
    await addAudit(300, { daysAgo: 2 });
    expect((await sources().auditAnomaly.run()).status).toBe('ok');
  });
});

describe('dataHygiene（真實 schema：migration 0078 DROP trip_entries.note 之後）', () => {
  beforeEach(async () => {
    await db.prepare(`DELETE FROM trips WHERE id = 't-hyg'`).run();
  });

  it('SQL 在現行 schema 上能執行（不是 no such column），乾淨資料 → ok', async () => {
    const r = await sources().dataHygiene.run();
    expect(r.error, '查詢本身失敗（schema 與 SQL 不一致）').toBeUndefined();
    expect(r).toMatchObject({ status: 'ok', total: 0 });
  });

  async function seedEntry(description: string | null) {
    await db.prepare(`INSERT INTO trips (id, name, owner_user_id, published) VALUES ('t-hyg', 'hyg', 'u-dc', 0)`).run();
    const day = await db.prepare(`INSERT INTO trip_days (trip_id, day_num) VALUES ('t-hyg', 1)`).run();
    const entry = await db.prepare(`INSERT INTO trip_entries (day_id, sort_order, description) VALUES (?, 1, ?)`).bind(day.meta.last_row_id, description).run();
    return entry.meta.last_row_id as number;
  }

  it('entry 說明含測試標記 → warning 並指出標記', async () => {
    await seedEntry('這個是 __TEST_ONLY__ 殘留');
    const r = await sources().dataHygiene.run();
    expect(r.status).toBe('warning');
    expect(r.leaks).toHaveLength(1);
    expect(r.leaks[0]).toMatchObject({ tripId: 't-hyg', dayNum: 1, marker: '__TEST_ONLY__' });
  });

  it('master POI（sort_order=1）的備註含標記 → 被掃到；備選 POI 的備註不掃', async () => {
    const entryId = await seedEntry(null);
    const poi = async (name: string) => (await db.prepare(`INSERT INTO pois (name, type) VALUES (?, 'attraction')`).bind(name).run()).meta.last_row_id;
    const [p1, p2] = [await poi('hyg-p1'), await poi('hyg-p2')];
    await db.prepare(`INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, note) VALUES (?, ?, 2, 'AUTO_TEST_FIXTURE')`).bind(entryId, p2).run();
    expect((await sources().dataHygiene.run()).status, '備選 POI 備註不該被掃').toBe('ok');
    await db.prepare(`INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, note) VALUES (?, ?, 1, 'AUTO_TEST_FIXTURE')`).bind(entryId, p1).run();
    const r = await sources().dataHygiene.run();
    expect(r.status).toBe('warning');
    expect(r.leaks[0].marker).toBe('AUTO_TEST_FIXTURE');
    await db.prepare(`DELETE FROM trip_entry_pois WHERE entry_id = ?`).bind(entryId).run();
    await db.prepare(`DELETE FROM pois WHERE name IN ('hyg-p1','hyg-p2')`).run();
  });
});

describe('npmAudit', () => {
  it('呼叫 npm audit 的 timeout ≥ 180 秒（registry 單次實測約 50 秒，60 秒貼邊會週期性假 critical）', async () => {
    const calls: Array<{ cmd: string; timeout?: number }> = [];
    const execSync = (cmd: string, opts: { timeout?: number }) => {
      calls.push({ cmd, timeout: opts.timeout });
      return JSON.stringify({ vulnerabilities: {} });
    };
    const r = await createCheckSources({ execSync, env: {} }).npmAudit.run();
    expect(r.error).toBeUndefined();   // 解析成功才算真的走完這條路徑
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toMatch(/npm audit/);
    expect(calls[0].timeout).toBeGreaterThanOrEqual(180000);
  });
});
