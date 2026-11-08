/**
 * 跨 repo 契約守衛（trip-planner#1626，承接 agent#5 第 3、4 項的 web 側）。
 *   第 3 項：agent daily-check 的 api_logs 排除字串 ↔ web 真的寫進 api_logs.error 的組字
 *            （_middleware：AppError → `${code}: ${detail}`）
 *   第 4 項：maps-settings 回應與 app_settings 不得再出現三個幽靈預算 key
 * 快照來源與更新方式見 tests/fixtures/agent-contract.README.md。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi } from './http';
import { serviceToken } from './service-token';
import { _resetGcpTokenCacheForTest } from '../../functions/api/_gcp_monitoring';

interface Contract { dailyCheckSql: Array<{ source: string; sql: string[] }> }
const contract: Contract = JSON.parse(readFileSync(join(__dirname, '../fixtures/agent-contract.json'), 'utf8'));

/** 快照裡某個 daily-check 來源的第 n 條 SQL；來源或順序變了就拋錯。 */
function sqlOf(source: string, index = 0): string {
  const sql = contract.dailyCheckSql.find((s) => s.source === source)?.sql[index];
  if (!sql) throw new Error(`快照缺少 daily-check 來源 ${source}[${index}]`);
  return sql;
}

let db: D1Database;
beforeAll(async () => { db = await createTestDb(); });
afterAll(async () => { vi.unstubAllGlobals(); await disposeMiniflare(); });

describe('第 3 項：daily-check 排除字串 ↔ web 實際寫入的 api_logs.error', () => {
  it('quota-estimate 在 GCP 不可用時寫入的那一筆，會被 apiErrors SQL 排除', async () => {
    _resetGcpTokenCacheForTest();
    // 沒設 GCP 憑證 → handler 直接 throw AppError(MAPS_UPSTREAM_FAILED, 詳情)，不打外部
    const api = createApi({ env: mockEnv(db) });
    const token = await serviceToken(db, ['ops:maps'], 'agent-contract-quota');
    expect((await api.get('/api/admin/quota-estimate', { bearer: token })).status).toBe(502);

    const row = await db.prepare("SELECT error FROM api_logs WHERE path = '/api/admin/quota-estimate'").first<{ error: string }>();
    expect(row, 'middleware 沒寫 api_logs').toBeTruthy();
    const hits = (await db.prepare(sqlOf('apiErrors')).all<{ path: string }>()).results.filter((r) => r.path === '/api/admin/quota-estimate');
    expect(hits, `排除字串與 web 寫入的 error 不一致，實際為：${row?.error}`).toEqual([]);
  });

  it('/api/route 的「Routes empty result」排除字串仍是 web 會丟出的訊息', () => {
    const m = sqlOf('apiErrors').match(/path = '\/api\/route' AND error = 'MAPS_UPSTREAM_FAILED: ([^']+)'/);
    expect(m, '快照的 apiErrors SQL 找不到 /api/route 排除條件').toBeTruthy();
    const src = readFileSync(join(__dirname, '../../src/server/maps/google-client.ts'), 'utf8');
    expect(src).toContain(`fail('${m![1]}')`);
  });
});

describe('第 4 項：幽靈預算 key 不得回來', () => {
  const PHANTOM = ['budget_usd', 'lock_threshold_pct', 'unlock_threshold_pct'];

  it('maps-settings 回應只有鎖定狀態三欄', async () => {
    const api = createApi({ env: mockEnv(db) });
    const token = await serviceToken(db, ['ops:maps'], 'agent-contract-maps');
    const res = await api.get('/api/admin/maps-settings', { bearer: token });
    expect(res.status).toBe(200);
    expect(Object.keys((await res.json()) as object).sort()).toEqual(['is_locked', 'locked_at', 'locked_reason']);
  });

  it('套完 migrations 的 app_settings 沒有任何 *_budget_usd／*_threshold_pct key', async () => {
    const keys = (await db.prepare('SELECT key FROM app_settings').all<{ key: string }>()).results.map((r) => r.key);
    expect(keys.filter((k) => PHANTOM.some((p) => k.endsWith(p)))).toEqual([]);
  });

  it('agent 的 daily-check SQL 不查幽靈 key', () => {
    const all = contract.dailyCheckSql.flatMap((s) => s.sql).join('\n');
    for (const p of PHANTOM) expect(all).not.toContain(p);
  });
});
