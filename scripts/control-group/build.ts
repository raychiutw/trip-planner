/**
 * 建立對照組：舊入口程式碼搭配消毒過的 staging 資料副本（拆分 T6）。
 *
 *   node scripts/control-group/build.ts [--out=.control-group] [--from-json=<檔>]
 *
 * 流程：只對白名單表從 staging 讀列（絕不連正式資料庫，憑證類表連 SELECT 都不下）→ 消毒 → 掃描輸出
 * （有任何真實 email／token 樣式就中止，不寫檔）→ 在本機持久化的 D1 套用 migration 並載入。
 * 產物在 --out（已 gitignore）；測試用 CONTROL_GROUP_DIR=<--out> 指過去（見 tests/api/setup.ts）。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Miniflare } from 'miniflare';
import { ALLOWED_SOURCE_DB, assertAllowedSource, COPY_TABLES, POLICY, tableOrder, type Row } from './policy.ts';
import { sanitize, type ForeignKey } from './sanitize.ts';
import { scan } from './scan.ts';

const root = path.resolve(import.meta.dirname, '../..');
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const outDir = path.resolve(arg('out') ?? path.join(root, '.control-group'));
const fromJson = arg('from-json');

/** 對 staging 下一條唯讀 SELECT。在暫存目錄執行，避免被專案目錄的 .env.local 裡失效的 token 蓋掉 OAuth 登入。 */
function query(sql: string): Row[] {
  if (!/^\s*SELECT\b/i.test(sql)) throw new Error('來源端只允許 SELECT');
  const r = spawnSync('npx', ['--yes', 'wrangler', 'd1', 'execute', ALLOWED_SOURCE_DB, '--remote', '--json', '--command', sql], {
    cwd: os.tmpdir(),
    encoding: 'utf-8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const parsed = JSON.parse(r.stdout || 'null');
  if (!Array.isArray(parsed)) throw new Error(`查詢失敗：${sql}\n${r.stdout.slice(0, 300)}${r.stderr.slice(0, 300)}`);
  return parsed[0].results as Row[];
}

function readSource(): Record<string, Row[]> {
  if (fromJson) return JSON.parse(fs.readFileSync(fromJson, 'utf8')) as Record<string, Row[]>;
  assertAllowedSource(ALLOWED_SOURCE_DB);
  const rows: Record<string, Row[]> = {};
  for (const table of COPY_TABLES) {
    const p = POLICY[table]!;
    // 截斷的表連多餘的列都不讀
    const limit = p.mode === 'copy' && p.keepNewest ? ` ORDER BY "${p.keepNewest.by}" DESC LIMIT ${p.keepNewest.count}` : '';
    rows[table] = query(`SELECT * FROM "${table}"${limit}`);
    console.log(`  讀 ${table}: ${rows[table]!.length} 列`);
  }
  return rows;
}

/** migration 檔逐條執行（D1 的 exec 不支援多行 SQL）。 */
function statements(sql: string): string[] {
  return sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
}

async function main(): Promise<void> {
  console.log(`來源：${fromJson ? fromJson : `${ALLOWED_SOURCE_DB}（唯讀）`}`);
  const source = readSource();

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'control-group' },
    d1Persist: path.join(outDir, 'd1'),
  });
  try {
    const db = await mf.getD1Database('DB');
    const dir = path.join(root, 'migrations');
    const files = fs.readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f) && !f.includes('rollback')).sort();
    for (const f of files) for (const stmt of statements(fs.readFileSync(path.join(dir, f), 'utf8'))) await db.prepare(stmt).run();

    // 外鍵關係 → 插入順序（父表在前）
    const edges: [string, string][] = [];
    const fks: ForeignKey[] = [];
    for (const t of COPY_TABLES) {
      const { results } = await db.prepare(`PRAGMA foreign_key_list("${t}")`).all<{ table: string; from: string; to: string }>();
      for (const fk of results) {
        edges.push([t, fk.table]);
        fks.push({ table: t, from: fk.from, parent: fk.table, to: fk.to });
      }
    }
    const order = tableOrder(edges, ['users', ...COPY_TABLES.filter((t) => t !== 'users')]);

    const { sql, counts } = sanitize(source, order, fks);
    const findings = scan(sql);
    if (findings.length > 0) {
      console.error(`✗ 消毒後仍掃到 ${findings.length} 筆真實 email／token 樣式，中止（不寫檔）：`);
      for (const f of findings.slice(0, 5)) console.error(`  [${f.kind}] ${f.match.slice(0, 6)}…（長度 ${f.match.length}）`);
      process.exitCode = 1;
      return;
    }
    fs.writeFileSync(path.join(outDir, 'sanitized.sql'), sql);

    // 載入前先關閉外鍵檢查不可靠（D1 不認跨敘述的 PRAGMA），所以靠 order 保證父表在前
    for (const line of sql.split('\n').filter(Boolean)) {
      try {
        await db.prepare(line).run();
      } catch (err) {
        // 只印表名與錯誤，不印那一列的內容
        throw new Error(`載入 ${/^INSERT INTO "(\w+)"/.exec(line)?.[1] ?? '?'} 失敗：${(err as Error).message}`);
      }
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`✓ 已載入 ${Object.keys(counts).length} 張表、${total} 列；掃描無真實 email／token 樣式`);
    console.log(`  產物：${outDir}`);
  } finally {
    await mf.dispose();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 2;
});
