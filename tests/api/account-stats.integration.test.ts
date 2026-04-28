/**
 * /api/account/stats — Account hub Profile hero 3 stats aggregate
 *
 * Section 2 (terracotta-account-hub-page) E1 (terracotta-mockup-parity-v2)：
 * 驗 SQL aggregate 算 trip count + total days + collaborator count 正確。
 *
 * 採 mock D1 prepare/first 模式（同 account-sessions.test 風格），不依賴
 * miniflare D1 fixture，純 unit-style 驗 endpoint 對 db 打的 SQL + 對 response
 * shape 的 mapping。
 *
 * 為何不打真 staging D1：staging-fixture-based test 已超出本 PR scope，shared
 * mock prepare/first 足以驗 SQL 結構 + response mapping 正確。
 */
import { describe, it, expect, vi } from 'vitest';
import { onRequestGet } from '../../functions/api/account/stats';
import type { AuthData } from '../../functions/api/_types';

interface MockEnv {
  DB: { prepare: ReturnType<typeof vi.fn> };
}

function makeStmt(firstResult: unknown = null) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
    all: vi.fn().mockResolvedValue({ results: [] }),
  };
}

function makeContext(
  request: Request,
  env: MockEnv,
  auth: AuthData | null = { email: 'ray@x.com', isAdmin: false, isServiceToken: false },
): Parameters<typeof onRequestGet>[0] {
  return {
    request,
    env: env as unknown as never,
    params: {} as unknown as never,
    data: { auth } as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof onRequestGet>[0];
}

describe('GET /api/account/stats', () => {
  it('401 when no auth', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const req = new Request('https://x.com/api/account/stats');
    await expect(onRequestGet(makeContext(req, env, null)))
      .rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('200 回 { tripCount, totalDays, collaboratorCount } 對應 SQL 結果', async () => {
    // 第一個 prepare 是 trip stats query，第二個是 collab stats query
    const tripStatsStmt = makeStmt({ trip_count: 2, total_days: 12 });
    const collabStmt = makeStmt({ collab_count: 3 });
    const dbPrepare = vi.fn()
      .mockReturnValueOnce(tripStatsStmt)
      .mockReturnValueOnce(collabStmt);
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const req = new Request('https://x.com/api/account/stats');
    const res = await onRequestGet(makeContext(req, env));
    expect(res.status).toBe(200);
    const body = await res.json() as { tripCount: number; totalDays: number; collaboratorCount: number };
    expect(body).toEqual({ tripCount: 2, totalDays: 12, collaboratorCount: 3 });
  });

  it('SQL bind email 為 lowercase（避免 case-sensitive permission table 漏算）', async () => {
    const tripStatsStmt = makeStmt({ trip_count: 0, total_days: 0 });
    const collabStmt = makeStmt({ collab_count: 0 });
    const dbPrepare = vi.fn()
      .mockReturnValueOnce(tripStatsStmt)
      .mockReturnValueOnce(collabStmt);
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const req = new Request('https://x.com/api/account/stats');
    await onRequestGet(makeContext(req, env, {
      email: 'Ray@X.com',
      isAdmin: false,
      isServiceToken: false,
    }));
    // tripStats bind 第一個 arg 是 lowercase email
    expect(tripStatsStmt.bind).toHaveBeenCalledWith('ray@x.com');
    // collab bind 兩個 arg 都是 lowercase email (第一是 user trip 過濾，第二是排除 self)
    expect(collabStmt.bind).toHaveBeenCalledWith('ray@x.com', 'ray@x.com');
  });

  it('null first 回應 → 全部 fallback 0', async () => {
    const tripStatsStmt = makeStmt(null);
    const collabStmt = makeStmt(null);
    const dbPrepare = vi.fn()
      .mockReturnValueOnce(tripStatsStmt)
      .mockReturnValueOnce(collabStmt);
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const req = new Request('https://x.com/api/account/stats');
    const res = await onRequestGet(makeContext(req, env));
    const body = await res.json() as { tripCount: number; totalDays: number; collaboratorCount: number };
    expect(body).toEqual({ tripCount: 0, totalDays: 0, collaboratorCount: 0 });
  });

  it('SQL 含 trip_permissions JOIN trips + LEFT JOIN day_counts (subquery)', async () => {
    const tripStatsStmt = makeStmt({ trip_count: 0, total_days: 0 });
    const collabStmt = makeStmt({ collab_count: 0 });
    const dbPrepare = vi.fn()
      .mockReturnValueOnce(tripStatsStmt)
      .mockReturnValueOnce(collabStmt);
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const req = new Request('https://x.com/api/account/stats');
    await onRequestGet(makeContext(req, env));
    const tripSql = dbPrepare.mock.calls[0]?.[0] as string;
    expect(tripSql).toContain('trip_permissions');
    expect(tripSql).toContain('FROM trips');
    expect(tripSql).toContain('INNER JOIN trip_permissions');
    expect(tripSql).toMatch(/LEFT JOIN \(\s*SELECT trip_id, COUNT\(\*\) AS day_count/);
    expect(tripSql).toContain('SUM(day_counts.day_count)');
    expect(tripSql).toContain('COUNT(DISTINCT t.id)');
    // 含 wildcard 「*」 grant 處理 (admin 開放所有 trip)
    expect(tripSql).toContain("tp.email = '*'");
  });

  it('SQL collab query 排除 self + 排除 wildcard email "*"', async () => {
    const tripStatsStmt = makeStmt({ trip_count: 0, total_days: 0 });
    const collabStmt = makeStmt({ collab_count: 0 });
    const dbPrepare = vi.fn()
      .mockReturnValueOnce(tripStatsStmt)
      .mockReturnValueOnce(collabStmt);
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const req = new Request('https://x.com/api/account/stats');
    await onRequestGet(makeContext(req, env));
    const collabSql = dbPrepare.mock.calls[1]?.[0] as string;
    expect(collabSql).toContain('COUNT(DISTINCT tp2.email)');
    expect(collabSql).toMatch(/tp2\.email\s*!=\s*\?/);
    expect(collabSql).toContain("tp2.email != '*'");
  });

  it('admin user 也能 fetch (不需特殊 isAdmin 判斷)', async () => {
    const tripStatsStmt = makeStmt({ trip_count: 5, total_days: 30 });
    const collabStmt = makeStmt({ collab_count: 8 });
    const dbPrepare = vi.fn()
      .mockReturnValueOnce(tripStatsStmt)
      .mockReturnValueOnce(collabStmt);
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const req = new Request('https://x.com/api/account/stats');
    const res = await onRequestGet(makeContext(req, env, {
      email: 'admin@x.com',
      isAdmin: true,
      isServiceToken: false,
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { tripCount: number };
    expect(body.tripCount).toBe(5);
  });
});
