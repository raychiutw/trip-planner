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

/**
 * schema 是否已跑完 migration。
 *
 * ⚠ 判定用**最後一個改 schema 的 migration**（0092 `trip_requests.terminal_reason`），不是
 * `trip_entries` 的形狀。`trip_entries` 建於 **0047**，而 migration 總數是 91 ——
 * 拿它當判定，「已遷移」在 0048–0091 全部還沒跑時就會成立（少 `account_notification_preferences`、
 * `poi_favorites` 的 soft-delete 欄位、`users` 的隱私同意欄位…）。
 *
 * 判定表要用**最後**改 schema 的那一個；新增 migration 若動 schema，這裡要跟著往後移。
 */
async function hasMigratedSchema(db: D1Database): Promise<boolean> {
  try {
    const info = await db.prepare('PRAGMA table_info(trip_requests)').all<{ name: string }>();
    const columnNames = new Set((info.results ?? []).map((col) => col.name));
    // 0092_trip_requests_terminal_reason.sql —— 目前最後一個 schema 變更
    return columnNames.has('terminal_reason');
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
  /*
   * ⚠ **決定「要不要跑 migration」必須在那個 memoized promise 內部**，不能在外面先 await。
   *
   * 原本的寫法是：
   *     if (!_cache.__tp_migrated) {
   *       if (await hasMigratedSchema(db)) { _cache.__tp_migrated = true; }   // ← 這裡
   *       else { _cache.__tp_migrationPromise ??= ...; await ...; }
   *     }
   *
   * 兩個併發呼叫（同一 process 內兩個 test file 的 beforeAll 重疊）都能通過
   * `!_cache.__tp_migrated`，然後**都停在 `await hasMigratedSchema(db)` 上**。
   * 呼叫 1 先醒、看到 false、開始跑 migration；呼叫 2 晚醒，此時 migration 已經跑掉一部分、
   * 判定表已成形 → 它得到 **true** → 設 `__tp_migrated = true` 並**直接返回，沒有等完剩下的
   * migration**。它的測試於是跑在半套 schema 上。
   *
   * 症狀是間歇的、只在整套跑（負載夠重、beforeAll 才會重疊）才出現：
   * 2026-07-26 `account-erasure.test.ts` 的「行程的子表一併清乾淨」就是這樣紅的 ——
   * 半套 schema 下 `trips` 被後面的 backup-restore migration 重建，先前 INSERT 的列消失，
   * `SELECT id FROM trips WHERE owner_user_id = ?` 回空集合 → 什麼都沒刪 → 子表 count 不為 0。
   *
   * 修法：整個「檢查 + 跑」放進單一 memoized promise，所有呼叫者 await 同一顆。
   */
  _cache.__tp_migrationPromise ??= (async () => {
    if (await hasMigratedSchema(_cache.__tp_db!)) return;
    for (const fileSql of getMigrationFiles()) {
      for (const stmt of extractStatements(fileSql)) {
        await _cache.__tp_db!.prepare(stmt).run();
      }
    }
  })().catch((err) => {
    _cache.__tp_migrationPromise = undefined;
    throw err;
  });
  await _cache.__tp_migrationPromise;

  /*
   * Post-condition：回傳前確認 schema 真的完整。
   * 這一條是「就算上面的推理錯了也要當場爆」的兜底 —— 半套 schema 造成的失敗會出現在
   * 隨機的下游斷言上（count 不對、no such column…），很難回推到 setup。寧可在這裡明講。
   */
  if (!_cache.__tp_migrated) {
    if (!(await hasMigratedSchema(_cache.__tp_db))) {
      throw new Error(
        'createTestDb: migration 跑完了但 schema 判定仍為 false —— '
        + 'hasMigratedSchema 的判定欄位可能已被新的 migration 改掉，請更新它',
      );
    }
    _cache.__tp_migrated = true;
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
