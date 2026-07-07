/**
 * API Test Setup — 用 Miniflare 建立帶 D1 的測試環境
 * 所有測試檔案共用同一個 Miniflare + D1 實例，migration 只跑一次
 */
import { Miniflare } from 'miniflare';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

// 快取 migration SQL（整個 test run 不變）
let _migrationFiles: string[] | null = null;
function getMigrationFiles(): string[] {
  if (!_migrationFiles) {
    _migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && !f.includes('rollback'))
      .sort()
      .map(f => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
  }
  return _migrationFiles;
}

/**
 * Miniflare D1 exec() 不支援多行 SQL，用 prepare().run() 逐條執行
 */
function extractStatements(sql: string): string[] {
  const cleaned = sql.replace(/--[^\n]*/g, '');
  return cleaned
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// v2.33.84: globalThis singleton — Vitest 4 即使在 isolate: false +
// maxWorkers: 1 仍會 per-file re-evaluate module，module-level `let _mf`
// 會被重置 → 新建 Miniflare → 累積 35+ workerd subprocess → port 耗盡。
// globalThis 是 process-scoped，跨 file re-eval 維持。
interface GlobalCache {
  __tp_mf?: Miniflare;
  __tp_db?: D1Database;
  __tp_migrated?: boolean;
  __tp_migrationPromise?: Promise<void>;
}
const _cache = globalThis as unknown as GlobalCache;

async function hasMigratedSchema(db: D1Database): Promise<boolean> {
  try {
    const table = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'trip_entries'")
      .first<{ name: string }>();
    if (!table) return false;

    const info = await db.prepare('PRAGMA table_info(trip_entries)').all<{ name: string }>();
    const columnNames = new Set((info.results ?? []).map((col) => col.name));
    return columnNames.has('id') && !columnNames.has('title');
  } catch {
    return false;
  }
}

/**
 * 取得共用 D1 database（lazy init + migration 只跑一次）
 */
export async function createTestDb(): Promise<D1Database> {
  if (!_cache.__tp_mf) {
    _cache.__tp_mf = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("ok"); } }',
      // Vitest's forks pool can re-evaluate this module in separate workers.
      // Give each process an isolated in-memory D1 id so migrations never race
      // against a DB created by another worker.
      d1Databases: { DB: `tripline-test-${process.pid}` },
      d1Persist: false,
    });
  }
  if (!_cache.__tp_db) {
    _cache.__tp_db = await _cache.__tp_mf.getD1Database('DB');
  }
  if (!_cache.__tp_migrated) {
    if (await hasMigratedSchema(_cache.__tp_db)) {
      _cache.__tp_migrated = true;
    } else {
      _cache.__tp_migrationPromise ??= (async () => {
        for (const fileSql of getMigrationFiles()) {
          for (const stmt of extractStatements(fileSql)) {
            await _cache.__tp_db!.prepare(stmt).run();
          }
        }
        _cache.__tp_migrated = true;
      })().catch((err) => {
        _cache.__tp_migrationPromise = undefined;
        throw err;
      });
      await _cache.__tp_migrationPromise;
    }
  }
  return _cache.__tp_db;
}

/**
 * 清理 Miniflare — 由 vitest globalTeardown 或最後一個測試呼叫
 * 多次呼叫安全（第二次起為 no-op）
 */
/**
 * v2.33.84 DEBUG: 改 no-op。原本每個 test file 在 afterAll 呼叫 dispose 害
 * singleton 失效（36 個 file × dispose = 不停 new Miniflare）。真正 dispose 應
 * 該在 vitest globalTeardown 跑一次即可，否則 per-file dispose = port leak。
 */
export async function disposeMiniflare(): Promise<void> {
  // intentionally empty - dispose only at globalTeardown
}
