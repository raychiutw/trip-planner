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

let _mf: Miniflare | null = null;
let _db: D1Database | null = null;
let _migrated = false;

/**
 * 取得共用 D1 database（lazy init + migration 只跑一次）
 */
export async function createTestDb(): Promise<D1Database> {
  if (!_mf) {
    _mf = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("ok"); } }',
      d1Databases: ['DB'],
    });
  }
  if (!_db) {
    _db = await _mf.getD1Database('DB');
  }
  if (!_migrated) {
    for (const fileSql of getMigrationFiles()) {
      for (const stmt of extractStatements(fileSql)) {
        await _db.prepare(stmt).run();
      }
    }
    _migrated = true;
  }
  return _db;
}

/**
 * 清理 Miniflare — 由 vitest globalTeardown 或最後一個測試呼叫
 * 多次呼叫安全（第二次起為 no-op）
 */
export async function disposeMiniflare(): Promise<void> {
  if (_mf) {
    await _mf.dispose();
    _mf = null;
    _db = null;
    _migrated = false;
  }
}
