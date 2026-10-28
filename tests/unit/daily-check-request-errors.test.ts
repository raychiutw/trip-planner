/**
 * daily-check.js — requestErrors 對真實 SQL 的行為（in-memory SQLite）。
 *
 * 2026-10-28 / 10-29 連兩天把使用者在 UI 主動取消的請求（#285、#288，
 * terminal_reason=cancelled）報成 warning。取消是使用者操作，不是故障。
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);

function runRequestErrors(rows: Array<[string, string | null]>) {
  const db = new DatabaseSync(':memory:');
  db.exec(
    "CREATE TABLE trip_requests (id INTEGER PRIMARY KEY, trip_id TEXT NOT NULL, message TEXT NOT NULL, reply TEXT, status TEXT NOT NULL, terminal_reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );
  const insert = db.prepare("INSERT INTO trip_requests (trip_id, message, status, terminal_reason) VALUES ('t1', 'm', ?, ?)");
  for (const [status, reason] of rows) insert.run(status, reason);
  const { createCheckSources } = require('../../scripts/daily-check.js');
  const sources = createCheckSources({ queryD1: async (sql: string) => db.prepare(sql).all(), env: {} });
  return sources.requestErrors.run();
}

describe('daily-check.js — queryRequestErrors', () => {
  it('使用者主動取消的請求不算錯誤', async () => {
    const result = await runRequestErrors([['failed', 'cancelled']]);
    expect(result).toMatchObject({ status: 'ok', total: 0 });
  });

  it('逾時、錯誤、需授權與還在跑的請求照報（terminal_reason 為 NULL 也照報）', async () => {
    const result = await runRequestErrors([
      ['failed', 'cancelled'],
      ['failed', 'timed_out'],
      ['failed', 'error'],
      ['failed', 'needs_consent'],
      ['failed', null],
      ['open', null],
      ['processing', null],
      ['completed', null],
    ]);
    expect(result).toMatchObject({ status: 'warning', total: 6, statusCounts: { open: 1, processing: 1, failed: 4 } });
  });
});
