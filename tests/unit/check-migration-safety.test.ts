// @vitest-environment node
/**
 * scripts/check-migration-safety.sh — 行為鎖。
 *
 * 這個 gate 存在的理由是 2026-05-04 的 0047 incident（DROP TABLE trips 觸發 CASCADE
 * 砍光 prod）。但從 CI 導入到 v2.55.81 為止，它在 CI 裡**從未擋下任何東西**：
 * actions/checkout 預設 fetch-depth: 1 → origin/master~1 不存在 → git diff fatal →
 * 被 `2>/dev/null || true` 吞掉 → 每個 migration 都被當成 historical → exit 0。
 * 它印綠燈，而且印得很有說服力。
 *
 * 所以本檔鎖的不是「gate 會過」，是「gate 會擋」與「gate 壞掉時會紅」。
 * 每個 case 都在一個真的 git repo 上跑真的 script，不 mock git。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/check-migration-safety.sh',
);

/** 帶 CASCADE child 的 baseline —— 沒有它 CASCADE_PARENTS 是空的，script 會直接 exit 0。 */
const BASELINE_SQL = `CREATE TABLE trips (id TEXT PRIMARY KEY);
CREATE TABLE trip_days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE
);
`;

/** 0047 那個 pattern：DROP 掉 cascade parent，沒有 backup-restore。 */
const UNSAFE_SQL = `DROP TABLE trips;\n`;

/** 同樣 DROP，但帶 _backup_ 標記 → script 認得，放行。 */
const SAFE_SQL = `CREATE TABLE _backup_trip_days AS SELECT * FROM trip_days;
DROP TABLE trips;
INSERT INTO trip_days SELECT * FROM _backup_trip_days;
DROP TABLE _backup_trip_days;
`;

interface GateResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runGate(cwd: string, args: string[]): GateResult {
  try {
    const stdout = execFileSync('bash', [SCRIPT, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? -1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

const repos: string[] = [];

/** 建一個真 git repo：baseline commit（有 CASCADE FK）+ 第二個 commit（帶入 newSql）。 */
function repo(newFile: string | null, newSql?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migsafe-'));
  repos.push(dir); // 先登記再動 git —— 中途拋錯也不會漏掉 temp dir
  const git = (cmd: string) => execSync(`git ${cmd}`, { cwd: dir, stdio: 'pipe' });
  git('init -q -b main');
  git('config user.email test@example.com');
  git('config user.name Test');
  git('config commit.gpgsign false');
  fs.mkdirSync(path.join(dir, 'migrations'));
  fs.writeFileSync(path.join(dir, 'migrations/0001_init.sql'), BASELINE_SQL);
  git('add -A');
  git('commit -q -m baseline');
  if (newFile && newSql) {
    fs.writeFileSync(path.join(dir, 'migrations', newFile), newSql);
    git('add -A');
    git('commit -q -m new');
  }
  return dir;
}

afterAll(() => {
  for (const d of repos) fs.rmSync(d, { recursive: true, force: true });
});

describe('check-migration-safety.sh', () => {
  describe('gate 壞掉時必須紅（v2.55.81 之前這條是綠的 —— 就是那個 bug）', () => {
    it('--since ref 解不開 → exit 2 + 講得出怎麼修，不是 exit 0 + PASS', () => {
      // 這正是 CI 淺 clone 的情況：ref 不存在。以前 → exit 0 + "PASS"。
      const r = runGate(repo(null), ['--since=origin/master~1']);
      expect(r.code).toBe(2);
      expect(r.stdout).not.toContain('PASS');
      // 訊息要指向修法，不能只把 git 的 fatal 丟出來
      expect(r.stderr).toContain('GATE BROKEN');
      expect(r.stderr).toContain('fetch-depth');
    });

    it('ref 解不開時就算有不安全 migration 也不能回報 PASS', () => {
      // 最惡的組合：gate 瞎了 + 真的有 0047-style migration。必須紅。
      const r = runGate(repo('0002_danger.sql', UNSAFE_SQL), ['--since=origin/master~1']);
      expect(r.code).not.toBe(0);
    });
  });

  describe('gate 真的擋得下東西', () => {
    it('NEW 的 DROP TABLE <cascade-parent> 無 backup → exit 1 + 擋 deploy', () => {
      const r = runGate(repo('0002_danger.sql', UNSAFE_SQL), ['--since=HEAD~1']);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('UNSAFE NEW');
      expect(r.stdout).toContain('Block deploy');
    });

    it('NEW 的 DROP TABLE 帶 _backup_ pattern → exit 0（正控：不是每條都紅）', () => {
      const r = runGate(repo('0002_safe.sql', SAFE_SQL), ['--since=HEAD~1']);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain('SAFE');
      expect(r.stdout).toContain('PASS');
    });

    it('歷史的不安全 migration 只 WARN 不擋（已套到 prod，擋了也沒用）', () => {
      const dir = repo('0002_danger.sql', UNSAFE_SQL);
      // 再疊一個無關 commit，讓 0002 落在 HEAD~1 之前 → 變成 historical
      fs.writeFileSync(path.join(dir, 'migrations/0003_noop.sql'), 'SELECT 1;\n');
      execSync('git add -A && git commit -q -m later', { cwd: dir, stdio: 'pipe' });
      const r = runGate(dir, ['--since=HEAD~1']);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain('HISTORICAL UNSAFE');
    });

    it('無 --since（本機掃全部）→ 全部當 NEW，不安全就紅', () => {
      const r = runGate(repo('0002_danger.sql', UNSAFE_SQL), []);
      expect(r.code).toBe(1);
    });
  });

  describe('回報的數字要是真的', () => {
    it('這次 push 沒碰 migrations/ → COUNT 印單一個 0，不是兩行', () => {
      // grep -c 在 no-match 時會印 0 **並且** exit 1 → 舊寫法的 `|| echo 0`
      // 會再補一個 0，COUNT 變成 "0\n0"，CI log 就多一行孤兒 0。
      const dir = repo(null);
      fs.writeFileSync(path.join(dir, 'README.md'), 'code-only push\n');
      execSync('git add -A && git commit -q -m docs', { cwd: dir, stdio: 'pipe' });
      const r = runGate(dir, ['--since=HEAD~1']);
      expect(r.stdout).toContain('NEW/modified migrations vs HEAD~1: 0');
      expect(r.stdout).not.toMatch(/HEAD~1: 0\n0/);
    });

    it('COUNT 要數對（2 個新 .sql → 2）', () => {
      const dir = repo('0002_a.sql', 'SELECT 1;\n');
      fs.writeFileSync(path.join(dir, 'migrations/0003_b.sql'), 'SELECT 2;\n');
      execSync('git add -A && git commit -q --amend --no-edit', { cwd: dir, stdio: 'pipe' });
      const r = runGate(dir, ['--since=HEAD~1']);
      expect(r.stdout).toContain('NEW/modified migrations vs HEAD~1: 2');
    });
  });
});
