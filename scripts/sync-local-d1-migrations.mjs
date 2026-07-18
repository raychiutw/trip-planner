#!/usr/bin/env node
/**
 * sync-local-d1-migrations — 把 pending migrations 套進**所有**本地 D1 sqlite 副本。
 *
 * 為何需要（見記憶 project_local_dev_d1_split）：`wrangler pages dev --d1 DB`（dev server）用的是
 * binding-only 的 **ad-hoc 本地 D1**，`wrangler d1 migrations apply`（需 wrangler.toml database，
 * 且本專案 D1 binding 是 env-scoped）**結構上碰不到它**。所以 `dev:init` 只套到 --env production 的
 * D1、套不到 dev server 那份 → 加 migration 後 dev server 查新欄 → 500。
 *
 * v2.33.89 移掉頂層 D1 binding（修 prod login 全壞）後，dev 的 ad-hoc D1 就與 migration workflow 脫鉤。
 * wrangler.toml 的 env.production/preview binding **不能動**（動了重演多週 prod 事故），故改在本地層
 * 用 sqlite3 直接把 migration 補進每一份有 d1_migrations 追蹤表的本地 D1。冪等（照各 DB 自己的
 * d1_migrations 只補 pending），資料保留（增量套用、非覆蓋）。
 *
 * 用法：`node scripts/sync-local-d1-migrations.mjs`（由 dev:init + predev 自動呼叫）。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const D1DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const MIGDIR = 'migrations';

function sqliteQuery(file, sql) {
  return execFileSync('sqlite3', [file, sql], { encoding: 'utf8' }).trim();
}
function sqliteExecFile(file, sqlFilePath) {
  execFileSync('sqlite3', [file], { input: fs.readFileSync(sqlFilePath, 'utf8'), encoding: 'utf8' });
}

if (!fs.existsSync(D1DIR)) {
  console.log('[sync-d1] 無本地 D1 state（尚未跑過 dev/dev:init），略過');
  process.exit(0);
}

// migrations/NNNN_*.sql（照編號排序），排除 rollback/ 子目錄。
const migrations = fs
  .readdirSync(MIGDIR)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();

const dbFiles = fs
  .readdirSync(D1DIR)
  .filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');

let totalApplied = 0;
let syncedDbs = 0;

for (const db of dbFiles) {
  const file = path.join(D1DIR, db);
  let applied;
  try {
    // 只處理有 d1_migrations 追蹤表的「真 D1」；空/殘留 ad-hoc 檔沒有此表 → 跳過。
    const rows = sqliteQuery(file, 'SELECT name FROM d1_migrations');
    applied = new Set(rows ? rows.split('\n').filter(Boolean) : []);
  } catch {
    continue;
  }
  const pending = migrations.filter((m) => !applied.has(m));
  if (pending.length === 0) continue;

  syncedDbs++;
  for (const m of pending) {
    try {
      sqliteExecFile(file, path.join(MIGDIR, m));
      // d1_migrations schema：(id AUTOINCREMENT, name UNIQUE, applied_at DEFAULT now)。
      sqliteQuery(file, `INSERT OR IGNORE INTO d1_migrations (name) VALUES ('${m.replace(/'/g, "''")}')`);
      totalApplied++;
      console.log(`[sync-d1] ${db.slice(0, 12)} ← ${m}`);
    } catch (err) {
      console.error(`[sync-d1] ✗ ${db.slice(0, 12)} 套 ${m} 失敗：${err.message.split('\n')[0]}`);
      console.error('[sync-d1]   若 d1_migrations 追蹤與實際 schema 不一致，考慮 `npm run dev:reset` 重建本地 D1。');
      process.exit(1);
    }
  }
}

console.log(
  totalApplied
    ? `[sync-d1] 已補 ${totalApplied} 筆 migration 到 ${syncedDbs} 份落後的本地 D1（含 dev server 的 ad-hoc D1）`
    : '[sync-d1] 所有本地 D1 副本皆為最新',
);
