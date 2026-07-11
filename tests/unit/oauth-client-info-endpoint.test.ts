/**
 * GET /api/oauth/client-info?client_id=<id> — Phase 2：consent 畫面用的公開 app 品牌資訊。
 *
 * ConsentPage 在使用者按「允許」前呼叫，顯示「哪個 app 要用我的帳號」（app_name / logo /
 * description / homepage）。鎖住不變式：
 *   - active client → 回 app_name/app_description/app_logo_url/homepage_url（snake_case，rawJson）
 *   - 缺 client_id → DATA_VALIDATION（400）
 *   - 未註冊 / 非 active → DATA_NOT_FOUND（404），不洩漏 suspended/pending app 名稱
 *   - 只 SELECT 公開品牌欄位（絕不回 client_secret）；SQL 帶 status='active' 過濾
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { onRequestGet } from '../../functions/api/oauth/client-info';

// DB mock：捕捉 SQL + bind 參數，回指定 row（或 null）。
function makeDb(row: unknown, capture?: (sql: string, bind: unknown[]) => void) {
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          capture?.(sql, args);
          return { first: async () => row ?? null };
        },
      };
    },
  };
}

function makeContext(clientId: string | null, db: unknown) {
  const url =
    clientId === null
      ? 'https://x.pages.dev/api/oauth/client-info'
      : `https://x.pages.dev/api/oauth/client-info?client_id=${encodeURIComponent(clientId)}`;
  return { request: new Request(url), env: { DB: db } } as unknown as Parameters<typeof onRequestGet>[0];
}

const ACTIVE_ROW = {
  app_name: 'Tripline 行程助理',
  app_description: '幫你把行程排進去',
  app_logo_url: null,
  homepage_url: 'https://trip-planner-dby.pages.dev',
};

describe('GET /api/oauth/client-info', () => {
  it('active client → 200 + 公開品牌欄位（snake_case，非 camelCase）', async () => {
    const res = await onRequestGet(makeContext('tripline-tp-request', makeDb(ACTIVE_ROW)));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual(ACTIVE_ROW);
    // rawJson 不 deepCamel：ConsentPage 的 ClientAppInfo 用 snake_case，appName 會壞掉。
    expect(body).not.toHaveProperty('appName');
    // 絕不外洩機密。
    expect(body).not.toHaveProperty('client_secret');
  });

  it('SQL：client_id 綁定 + status=active 過濾，不 SELECT client_secret', async () => {
    let seenSql = '';
    let seenBind: unknown[] = [];
    await onRequestGet(
      makeContext(
        'tripline-tp-request',
        makeDb(ACTIVE_ROW, (sql, bind) => {
          seenSql = sql;
          seenBind = bind;
        }),
      ),
    );
    expect(seenSql).toMatch(/from\s+client_apps/i);
    expect(seenSql).toMatch(/status\s*=\s*'active'/i);
    expect(seenSql).not.toMatch(/client_secret/i);
    expect(seenBind).toEqual(['tripline-tp-request']);
  });

  it('缺 client_id → DATA_VALIDATION（400）', async () => {
    await expect(onRequestGet(makeContext(null, makeDb(null)))).rejects.toMatchObject({
      code: 'DATA_VALIDATION',
    });
  });

  it('未註冊 / 非 active → DATA_NOT_FOUND（404，保留 ConsentPage 保底顯示）', async () => {
    await expect(onRequestGet(makeContext('ghost-client', makeDb(null)))).rejects.toMatchObject({
      code: 'DATA_NOT_FOUND',
    });
  });

  it('client_id 前後空白會 trim', async () => {
    let seenBind: unknown[] = [];
    await onRequestGet(
      makeContext(
        '  tripline-tp-request  ',
        makeDb(ACTIVE_ROW, (_sql, bind) => {
          seenBind = bind;
        }),
      ),
    );
    expect(seenBind).toEqual(['tripline-tp-request']);
  });
});
