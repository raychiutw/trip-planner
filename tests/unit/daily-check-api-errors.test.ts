/**
 * daily-check.js — API error query contract.
 *
 * （trip docs 404 那條已隨 trip_docs 退場移除，2026-07-29）
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);

const DAILY_CHECK_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../scripts/daily-check.js'),
  'utf8',
);

describe('daily-check.js — API error filters', () => {
  it('ignores expected 401 / 403 / 429 auth and rate-limit statuses', () => {
    expect(DAILY_CHECK_SRC).toContain('status NOT IN (401, 403, 429)');
  });


  it('does not escalate expected /api/route "no drivable route" 502 (P11/T13 design)', () => {
    expect(DAILY_CHECK_SRC).toContain(
      "status = 502 AND path = '/api/route' AND error = 'MAPS_UPSTREAM_FAILED: Routes empty result'",
    );
  });

  it('only escalates non-5xx client errors after a small volume threshold', () => {
    expect(DAILY_CHECK_SRC).toContain('CLIENT_ERROR_WARNING_THRESHOLD');
    expect(DAILY_CHECK_SRC).toContain('total >= CLIENT_ERROR_WARNING_THRESHOLD');
  });
});

// 真的執行 SQL（in-memory SQLite），不只 grep 原始碼。
describe('daily-check.js — queryApiErrors 對真實 SQL 的行為', () => {
  function runApiErrors(rows: Array<[string, number, string | null]>) {
    const db = new DatabaseSync(':memory:');
    db.exec(
      "CREATE TABLE api_logs (id INTEGER PRIMARY KEY, method TEXT NOT NULL, path TEXT NOT NULL, status INTEGER NOT NULL, error TEXT, duration INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), source TEXT)",
    );
    const insert = db.prepare("INSERT INTO api_logs (method, path, status, error, source) VALUES ('GET', ?, ?, ?, 'anonymous')");
    for (const [p, status, error] of rows) insert.run(p, status, error);
    const { createCheckSources } = require('../../scripts/daily-check.js');
    const sources = createCheckSources({ queryD1: async (sql: string) => db.prepare(sql).all(), env: {} });
    return sources.apiErrors.run();
  }

  // 2026-09-26：daily-check 自己打 quota-estimate 撞 GCP 10s timeout → 502。當次 run 已由
  // googleMapsQuota 來源回報；隔天 run 的 24h 視窗又撈到同一筆並升級成 critical，重複告警。
  it('不重報 daily-check 自己打出的 quota-estimate 502 MAPS_UPSTREAM_FAILED', async () => {
    const result = await runApiErrors([
      ['/api/admin/quota-estimate', 502, 'MAPS_UPSTREAM_FAILED: Google Cloud Monitoring 無法取得用量（GOOGLE_CLOUD_SA_KEY / GOOGLE_CLOUD_PROJECT_ID 未設定或 API 失敗）'],
    ]);
    expect(result).toMatchObject({ status: 'ok', total: 0 });
  });

  // 精確比對：quota-estimate.ts 改訊息時排除會失效 → 往「照報」方向壞，不會靜默吞掉。
  it('排除字串與 quota-estimate.ts 實際丟出的訊息一致', () => {
    const endpointSrc = fs.readFileSync(path.resolve(__dirname, '../../functions/api/admin/quota-estimate.ts'), 'utf8');
    expect(endpointSrc).toContain(
      "'Google Cloud Monitoring 無法取得用量（GOOGLE_CLOUD_SA_KEY / GOOGLE_CLOUD_PROJECT_ID 未設定或 API 失敗）'",
    );
  });

  it('quota-estimate 的其他 5xx、其他 502 訊息與其他 path 的 502 照常 critical', async () => {
    const result = await runApiErrors([
      ['/api/admin/quota-estimate', 500, 'Internal error'],
      ['/api/admin/quota-estimate', 502, 'MAPS_UPSTREAM_FAILED: 未來新增的其他失敗情境'],
      ['/api/trips/t1/days', 502, 'MAPS_UPSTREAM_FAILED: Routes timeout'],
    ]);
    expect(result.status).toBe('critical');
    expect(result.errors.map((e: { path: string; status: number }) => `${e.path} ${e.status}`).sort()).toEqual([
      '/api/admin/quota-estimate 500',
      '/api/admin/quota-estimate 502',
      '/api/trips/t1/days 502',
    ]);
  });
});
