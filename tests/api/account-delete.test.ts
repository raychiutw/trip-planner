// @vitest-environment node
/**
 * DELETE /api/account — 帳號刪除 endpoint
 *
 * Google Play 對「可建立帳號的 app」**強制要求**帳號刪除路徑（app 內 + 網頁各一條）。
 *
 * 這支用**真 Miniflare D1**（非 mock DB）—— 本 endpoint 的重點就是「資料真的被刪掉」，
 * mock 掉 DB 等於在測自己寫的 mock。
 *
 * 安全性要求（不可退讓）：
 *   - 未登入 → 401
 *   - 有密碼身分的帳號 → 必須帶密碼二次確認才可刪（不可逆操作）
 *   - 密碼錯 → 401，且**不得**動到任何資料
 *   - 成功後 → 使用者資料消失、session cookie 被清除
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { onRequestDelete, onRequestGet } from '../../functions/api/account/index';
import { issueSession } from '../../functions/api/_session';
import { hashPassword } from '../../src/server/password';
import { createTestDb, disposeMiniflare } from './setup';

const SESSION_SECRET = 'test-secret-32-chars-long-enough';

describe('DELETE /api/account', () => {
  let db: D1Database;

  beforeAll(async () => { db = await createTestDb(); }, 30000);
  afterAll(async () => { await disposeMiniflare(); });

  let seq = 0;
  /** users.id 是 TEXT PK（非 autoincrement）→ 必須顯式給值。 */
  async function seedUser(password?: string): Promise<{ id: string; email: string }> {
    const id = `del-u${++seq}`;
    const email = `${id}@example.com`;
    await db.prepare(`INSERT INTO users (id, email, display_name, status) VALUES (?, ?, ?, 'active')`)
      .bind(id, email, id).run();
    if (password) {
      await db.prepare(
        `INSERT INTO auth_identities (user_id, provider, provider_user_id, password_hash, password_algo)
         VALUES (?, 'local', ?, ?, 'pbkdf2')`,
      ).bind(id, email, await hashPassword(password)).run();
    }
    return { id, email };
  }

  function env() {
    return { SESSION_SECRET, DB: db } as unknown as never;
  }

  async function authedRequest(userId: string, body: unknown): Promise<Request> {
    const carrier = new Response(null);
    await issueSession(
      new Request('https://x.com', { headers: { 'CF-Connecting-IP': '1.1.1.1' } }),
      carrier, userId, { SESSION_SECRET } as never,
    );
    const cookie = (carrier.headers.get('Set-Cookie') ?? '').split(';')[0] ?? '';
    return new Request('https://x.com/api/account', {
      method: 'DELETE',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function ctx(request: Request) {
    return {
      request, env: env(), params: {} as never, data: {} as never,
      next: () => Promise.resolve(new Response()),
      waitUntil: () => undefined, passThroughOnException: () => undefined,
    } as unknown as Parameters<typeof onRequestDelete>[0];
  }

  // handler 直接 throw AppError，由 _middleware 轉成 Response —— 直接呼叫 handler 時
  // 拿到的是 throw。既有 account-sessions.test.ts 同慣例。
  it('未登入 → AUTH_REQUIRED', async () => {
    const req = new Request('https://x.com/api/account', { method: 'DELETE' });
    await expect(onRequestDelete(ctx(req))).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('有密碼身分但沒帶密碼 → 400，且資料不動', async () => {
    const u = await seedUser('correct-horse-battery');
    await expect(onRequestDelete(ctx(await authedRequest(u.id, {}))))
      .rejects.toMatchObject({ code: 'ACCOUNT_DELETE_CONFIRM_REQUIRED' });

    const still = await db.prepare('SELECT count(*) AS n FROM users WHERE id = ?').bind(u.id).first<{ n: number }>();
    expect(still!.n, '未確認前不得刪除任何資料').toBe(1);
  });

  it('密碼錯 → 401，且資料不動', async () => {
    const u = await seedUser('correct-horse-battery');
    await expect(onRequestDelete(ctx(await authedRequest(u.id, { password: 'wrong-password' }))))
      .rejects.toMatchObject({ code: 'ACCOUNT_DELETE_PASSWORD_INVALID' });

    const still = await db.prepare('SELECT count(*) AS n FROM users WHERE id = ?').bind(u.id).first<{ n: number }>();
    expect(still!.n, '密碼錯時不得刪除任何資料').toBe(1);
  });

  it('密碼正確 → 200，使用者與其行程都消失', async () => {
    const u = await seedUser('correct-horse-battery');
    await db.prepare(`INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)`)
      .bind('del-trip-1', '待刪', u.id).run();

    const res = await onRequestDelete(ctx(await authedRequest(u.id, { password: 'correct-horse-battery' })));
    expect(res.status).toBe(200);

    const user = await db.prepare('SELECT count(*) AS n FROM users WHERE id = ?').bind(u.id).first<{ n: number }>();
    const trip = await db.prepare('SELECT count(*) AS n FROM trips WHERE id = ?').bind('del-trip-1').first<{ n: number }>();
    expect(user!.n, '使用者應消失').toBe(0);
    expect(trip!.n, '擁有的行程應一併刪除').toBe(0);
  });

  it('成功時清除 session cookie（不能讓已刪帳號的 cookie 還能用）', async () => {
    const u = await seedUser('correct-horse-battery');
    const res = await onRequestDelete(ctx(await authedRequest(u.id, { password: 'correct-horse-battery' })));
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie, '必須回 Set-Cookie 清除 session').toMatch(/Max-Age=0|Expires=/i);
  });

  it('回傳刪除摘要（使用者要看得到動了什麼）', async () => {
    const u = await seedUser('correct-horse-battery');
    await db.prepare(`INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)`)
      .bind('del-trip-2', '摘要', u.id).run();

    const res = await onRequestDelete(ctx(await authedRequest(u.id, { password: 'correct-horse-battery' })));
    const json = await res.json() as { ok: boolean; tripsDeleted: number };
    expect(json.ok).toBe(true);
    expect(json.tripsDeleted).toBe(1);
  });

  // ── GET /api/account —— 刪除前的影響預覽 ──────────────────────────
  // 確認對話框必須顯示「會刪掉什麼」。owner 決策是「行程一併刪除，含共編者的」，
  // 所以使用者按下去之前一定要看到受影響的共編人數 —— 猜不得，只能後端算。
  describe('GET /api/account — 刪除影響預覽', () => {
    function getCtx(request: Request) {
      return {
        request, env: env(), params: {} as never, data: {} as never,
        next: () => Promise.resolve(new Response()),
        waitUntil: () => undefined, passThroughOnException: () => undefined,
      } as unknown as Parameters<typeof onRequestGet>[0];
    }
    async function authedGet(userId: string): Promise<Request> {
      const carrier = new Response(null);
      await issueSession(
        new Request('https://x.com', { headers: { 'CF-Connecting-IP': '1.1.1.1' } }),
        carrier, userId, { SESSION_SECRET } as never,
      );
      const cookie = (carrier.headers.get('Set-Cookie') ?? '').split(';')[0] ?? '';
      return new Request('https://x.com/api/account', { headers: { Cookie: cookie } });
    }

    it('未登入 → AUTH_REQUIRED', async () => {
      await expect(onRequestGet(getCtx(new Request('https://x.com/api/account'))))
        .rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    });

    it('回報該帳號要用密碼還是確認字串', async () => {
      const withPw = await seedUser('correct-horse-battery');
      const r1 = await onRequestGet(getCtx(await authedGet(withPw.id)));
      expect((await r1.json() as { hasPassword: boolean }).hasPassword).toBe(true);

      const oauthOnly = await seedUser();
      const r2 = await onRequestGet(getCtx(await authedGet(oauthOnly.id)));
      expect((await r2.json() as { hasPassword: boolean }).hasPassword).toBe(false);
    });

    it('回報會被刪掉的行程數，以及受影響的共編人數', async () => {
      const owner = await seedUser('preview-pass-1234');
      const mate1 = await seedUser();
      const mate2 = await seedUser();
      await db.prepare(`INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)`)
        .bind('preview-trip', '有共編', owner.id).run();
      // 兩位共編者 + owner 自己的權限列
      for (const m of [mate1, mate2]) {
        await db.prepare(`INSERT INTO trip_permissions (trip_id, user_id, role) VALUES (?, ?, 'member')`)
          .bind('preview-trip', m.id).run();
      }
      await db.prepare(`INSERT INTO trip_permissions (trip_id, user_id, role) VALUES (?, ?, 'owner')`)
        .bind('preview-trip', owner.id).run();

      const res = await onRequestGet(getCtx(await authedGet(owner.id)));
      const body = await res.json() as { tripsOwned: number; collaboratorsAffected: number };
      expect(body.tripsOwned).toBe(1);
      expect(body.collaboratorsAffected, '不可把 owner 自己算進共編人數').toBe(2);
    });
  });

  it('純 OAuth 帳號（無密碼身分）不需密碼，但需顯式確認字串', async () => {
    // Google 登入的使用者沒有 password_hash，不能要求他打密碼。
    // 改要求顯式確認字串，避免誤觸這個不可逆操作。
    const u = await seedUser(); // 無密碼

    await expect(onRequestDelete(ctx(await authedRequest(u.id, {}))), '無密碼帳號仍需確認')
      .rejects.toMatchObject({ code: 'ACCOUNT_DELETE_CONFIRM_REQUIRED' });

    const ok = await onRequestDelete(ctx(await authedRequest(u.id, { confirm: 'DELETE' })));
    expect(ok.status).toBe(200);

    const left = await db.prepare('SELECT count(*) AS n FROM users WHERE id = ?').bind(u.id).first<{ n: number }>();
    expect(left!.n).toBe(0);
  });
});
