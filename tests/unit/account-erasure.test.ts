// @vitest-environment node
/**
 * 帳號刪除（erasure routine）
 *
 * Google Play 對「可建立帳號的 app」**強制要求**帳號刪除路徑，不做會直接退件。
 *
 * Owner 決策（2026-07-20）：
 *   - 擁有的行程 → **一併刪除**（含共編者的）
 *   - audit_log  → **匿名化保留列**（洗掉個資，保留行為紀錄供稽核）
 *
 * ⚠ 為什麼不靠 CASCADE：
 *   ① live schema 有 6 張表帶 `trip_id` 卻**無** trips 外鍵（audit_log / error_reports /
 *      permissions / requests / trip_requests / trip_permissions）→ 刪 trip 會留孤兒
 *   ② 有 14 張表存了使用者身分卻**無** users 外鍵 → 刪 user 完全不連動
 *   ③ 不依賴 FK 強制設定，順序自己控、可測
 *   所以 routine 逐表顯式刪除。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { eraseUserAccount, ERASURE_ANON_PREFIX } from '../../functions/api/_erasure';

describe('eraseUserAccount — 帳號刪除', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30000);

  afterAll(async () => {
    await disposeMiniflare();
  });

  /**
   * 建一個測試使用者，回傳 id。
   * ⚠ `users.id` 是 **TEXT PK**（非 autoincrement integer）→ 必須顯式給值，
   *   否則 id 為 NULL，後續所有 FK 綁定都會炸 NOT NULL。
   */
  let seq = 0;
  async function seedUser(email: string): Promise<string> {
    const id = `erase-u${++seq}`;
    await db.prepare(
      `INSERT INTO users (id, email, display_name, status) VALUES (?, ?, ?, 'active')`,
    ).bind(id, email, email.split('@')[0]).run();
    return id;
  }

  it('刪除使用者本身', async () => {
    const uid = await seedUser('erase-me@example.com');
    await eraseUserAccount(db, uid);
    const left = await db.prepare('SELECT count(*) AS n FROM users WHERE id = ?').bind(uid).first<{ n: number }>();
    expect(left!.n).toBe(0);
  });

  it('刪除該使用者擁有的行程（trips.owner_user_id 是 RESTRICT，不先刪就刪不掉 user）', async () => {
    const uid = await seedUser('owner@example.com');
    await db.prepare(
      `INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)`,
    ).bind('erase-trip-1', '待刪行程', uid).run();

    await eraseUserAccount(db, uid);

    const trip = await db.prepare('SELECT count(*) AS n FROM trips WHERE id = ?').bind('erase-trip-1').first<{ n: number }>();
    expect(trip!.n, '行程應一併刪除（owner 決策）').toBe(0);
  });

  it('行程的子表一併清乾淨（顯式刪，不靠 CASCADE）', async () => {
    const uid = await seedUser('with-children@example.com');
    await db.prepare(`INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)`)
      .bind('erase-trip-2', '有子資料', uid).run();
    // 挑幾張含個資的子表：航班編號 / 訂房編號 / 緊急聯絡人
    await db.prepare(`INSERT INTO trip_flights (trip_id, flight_no) VALUES (?, ?)`)
      .bind('erase-trip-2', 'BR123').run();
    await db.prepare(`INSERT INTO trip_emergency_contacts (trip_id, name, phone) VALUES (?, ?, ?)`)
      .bind('erase-trip-2', '緊急聯絡人', '0912345678').run();

    await eraseUserAccount(db, uid);

    for (const t of ['trip_flights', 'trip_emergency_contacts']) {
      const n = await db.prepare(`SELECT count(*) AS n FROM ${t} WHERE trip_id = ?`)
        .bind('erase-trip-2').first<{ n: number }>();
      expect(n!.n, `${t} 應隨行程刪除`).toBe(0);
    }
  });

  it('清掉「有 trip_id 但無 trips 外鍵」的孤兒列', async () => {
    const uid = await seedUser('orphan@example.com');
    await db.prepare(`INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)`)
      .bind('erase-trip-3', '孤兒測試', uid).run();
    await db.prepare(`INSERT INTO trip_permissions (trip_id, user_id, role) VALUES (?, ?, 'member')`)
      .bind('erase-trip-3', uid).run();

    await eraseUserAccount(db, uid);

    const perm = await db.prepare('SELECT count(*) AS n FROM trip_permissions WHERE trip_id = ?')
      .bind('erase-trip-3').first<{ n: number }>();
    expect(perm!.n, 'trip_permissions.trip_id 無外鍵，必須顯式刪').toBe(0);
  });

  it('audit_log 匿名化：保留列，但 changed_by 不再是明文 email', async () => {
    const uid = await seedUser('audited@example.com');
    await db.prepare(
      `INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, changed_by_user_id)
       VALUES (?, 'trips', '1', 'update', ?, ?)`,
    ).bind('erase-trip-4', 'audited@example.com', uid).run();

    await eraseUserAccount(db, uid);

    const row = await db.prepare('SELECT changed_by FROM audit_log WHERE changed_by_user_id IS NULL OR changed_by LIKE ?')
      .bind(`${ERASURE_ANON_PREFIX}%`).first<{ changed_by: string }>();
    expect(row, 'audit 列應保留（owner 決策：匿名化不刪除）').not.toBeNull();
    expect(row!.changed_by, 'changed_by 不得殘留明文 email').not.toContain('audited@example.com');
    expect(row!.changed_by).toContain(ERASURE_ANON_PREFIX);
  });

  it('清掉無 users 外鍵的身分殘留（session_devices）', async () => {
    const uid = await seedUser('sessions@example.com');
    await db.prepare(`INSERT INTO session_devices (sid, user_id, ua_summary) VALUES (?, ?, ?)`)
      .bind('erase-sid-1', uid, 'Chrome · macOS').run();

    await eraseUserAccount(db, uid);

    const n = await db.prepare('SELECT count(*) AS n FROM session_devices WHERE user_id = ?')
      .bind(uid).first<{ n: number }>();
    expect(n!.n, 'session_devices.user_id 無外鍵 → 刪帳號後 session 會殘留').toBe(0);
  });

  it('回傳摘要供 audit / 使用者確認', async () => {
    const uid = await seedUser('summary@example.com');
    await db.prepare(`INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)`)
      .bind('erase-trip-5', '摘要測試', uid).run();

    const summary = await eraseUserAccount(db, uid);

    expect(summary.userId).toBe(uid);
    expect(summary.tripsDeleted).toBe(1);
    expect(summary.tablesCleared, '摘要要能說明實際動了哪些表').toBeTypeOf('object');
  });

  it('刪不存在的 user 不炸（冪等）', async () => {
    await expect(eraseUserAccount(db, 'no-such-user')).resolves.toBeTruthy();
  });
});
