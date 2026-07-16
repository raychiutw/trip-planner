// @vitest-environment node
/**
 * scripts/d1-pending-migrations.js — 把 d1_migrations 查詢結果換算成 pending 清單。
 *
 * 這支的輸出直接決定 migration gate 檢查誰。空清單 = 全部放行，所以「算不出來」
 * 絕對不能長得跟「沒有 pending」一樣 —— 那正是 gate 兩年沒擋過任何東西的原因。
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/d1-pending-migrations.js',
);

const dirs: string[] = [];

/** 建一個裝著指定 .sql 檔名的 migrations 目錄。 */
function migrationsDir(files: string[]): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'd1pending-'));
  dirs.push(d);
  fs.mkdirSync(path.join(d, 'migrations'));
  for (const f of files) fs.writeFileSync(path.join(d, 'migrations', f), 'SELECT 1;\n');
  return d;
}

/** wrangler --json 的真實形狀（實測自 wrangler 4.105.0）。 */
const wranglerJson = (names: string[]) =>
  JSON.stringify([{ results: names.map((name) => ({ name })), success: true, meta: {} }]);

function run(cwd: string, stdin: string): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('node', [SCRIPT, 'migrations'], {
      cwd,
      input: stdin,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? -1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

afterAll(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

describe('d1-pending-migrations.js', () => {
  it('pending = 檔案 − 已套用', () => {
    const d = migrationsDir(['0001_a.sql', '0002_b.sql', '0003_c.sql']);
    const r = run(d, wranglerJson(['0001_a.sql']));
    expect(r.code).toBe(0);
    expect(r.stdout.trim().split('\n')).toEqual(['0002_b.sql', '0003_c.sql']);
  });

  it('全部套用過 → 空輸出（合法的「沒有 pending」）', () => {
    const d = migrationsDir(['0001_a.sql']);
    const r = run(d, wranglerJson(['0001_a.sql']));
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('全新 DB（d1_migrations 查得到但空的）→ 每個都 pending', () => {
    // 空 results 是合法狀態，不是錯誤。與「查詢沒跑成」必須區分開。
    const d = migrationsDir(['0001_a.sql', '0002_b.sql']);
    const r = run(d, wranglerJson([]));
    expect(r.code).toBe(0);
    expect(r.stdout.trim().split('\n')).toEqual(['0001_a.sql', '0002_b.sql']);
  });

  it('已套用但檔案已刪 → 不影響（真實 prod 就有兩個這種孤兒）', () => {
    const d = migrationsDir(['0002_b.sql']);
    const r = run(d, wranglerJson(['0001_deleted.sql', '0002_b.sql']));
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('stdin 不是 JSON（wrangler 認證掛了印錯誤訊息）→ exit 2，不可回空清單', () => {
    // 回空 = 沒有 pending = 全部放行。這正是 gate 從未擋下任何東西的形狀。
    const d = migrationsDir(['0001_a.sql']);
    const r = run(d, '✘ [ERROR] Authentication error [code: 10000]');
    expect(r.code).toBe(2);
    expect(r.stdout.trim()).toBe('');
    expect(r.stderr).toContain('解析不出');
  });

  it('migrations/ 沒有任何 .sql → exit 2，不可回報「沒有 pending」', () => {
    const d = migrationsDir([]);
    const r = run(d, wranglerJson([]));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('沒有任何 .sql');
  });

  it('沒給目錄參數 → exit 2', () => {
    const d = migrationsDir(['0001_a.sql']);
    let code = 0;
    try {
      execFileSync('node', [SCRIPT], { cwd: d, input: wranglerJson([]), stdio: 'pipe' });
    } catch (err) {
      code = (err as { status?: number }).status ?? -1;
    }
    expect(code).toBe(2);
  });
});
