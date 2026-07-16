// @vitest-environment node
/**
 * scripts/check-migration-safety.sh — 行為鎖。
 *
 * 這個 gate 存在的理由是 2026-05-04 的 0047 incident（DROP TABLE trips 觸發 CASCADE
 * 砍光 prod）。但從 CI 導入到本檔誕生為止，它在 CI 裡**從未擋下任何東西**：
 * actions/checkout 預設 fetch-depth: 1 → origin/master~1 不存在 → git diff fatal →
 * 被 `2>/dev/null || true` 吞掉 → 每個 migration 都被當成 historical → exit 0。
 * 它印綠燈，而且印得很有說服力。
 *
 * 所以本檔鎖的不是「gate 會過」，是「gate 會擋」與「gate 壞掉時會紅」。
 * 每個 case 都在一個真的 git repo 上跑真的 script，不 mock git。
 */
import { describe, it, expect, afterAll } from 'vitest';
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

/** 同樣的 FK，但寫成多行 FOREIGN KEY 子句 —— 完全合法的 SQL，單行 grep 抓不到。 */
const BASELINE_MULTILINE_SQL = `CREATE TABLE trips (id TEXT PRIMARY KEY);
CREATE TABLE trip_days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  FOREIGN KEY (trip_id)
    REFERENCES trips(id)
    ON DELETE CASCADE
);
`;

/** 表名帶數字。真實 corpus 有這種（0019_normalize_docs.sql 的 trip_docs_v2）。 */
const BASELINE_DIGIT_SQL = `CREATE TABLE trip_docs_v2 (id TEXT PRIMARY KEY);
CREATE TABLE doc_entries (
  doc_id INTEGER NOT NULL REFERENCES trip_docs_v2(id) ON DELETE CASCADE
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
function repo(newFile: string | null, newSql?: string, baseline = BASELINE_SQL): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migsafe-'));
  repos.push(dir); // 先登記再動 git —— 中途拋錯也不會漏掉 temp dir
  const git = (cmd: string) => execSync(`git ${cmd}`, { cwd: dir, stdio: 'pipe' });
  git('init -q -b main');
  git('config user.email test@example.com');
  git('config user.name Test');
  git('config commit.gpgsign false');
  fs.mkdirSync(path.join(dir, 'migrations'));
  fs.writeFileSync(path.join(dir, 'migrations/0001_init.sql'), baseline);
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
  describe('gate 壞掉時必須紅（本檔誕生前這幾條都是綠的 —— 就是那個 bug）', () => {
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

    it('掃不到任何 .sql → exit 2，不能當成「沒有 CASCADE 關聯」放行', () => {
      // 錯的 --dir / 移走的 migrations/ / sparse checkout 都會讓 glob 靜默展不開。
      // 以前：CASCADE_PARENTS 空 → 「No CASCADE FK relationships detected」→ exit 0。
      const r = runGate(repo('0002_danger.sql', UNSAFE_SQL), ['--since=HEAD~1', '--dir=nope']);
      expect(r.code).toBe(2);
      expect(r.stdout).not.toContain('PASS');
    });

    it('打錯的參數 → exit 2，不能默默用預設值掃完然後 PASS', () => {
      // `--sicne=` 這種 typo 若被忽略，script 會退化成無 gate mode（全掃、全當 NEW），
      // 而 CI 只看 exit code —— 拿到 0 就以為 gate 過了。exit 2 才擋得住。
      const r = runGate(repo('0002_safe.sql', SAFE_SQL), ['--sicne=HEAD~1']);
      expect(r.code).toBe(2);
      expect(r.stdout).not.toContain('PASS');
      expect(r.stderr).toContain('Unknown arg');
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

    it('早於 --since 的不安全 migration 只 WARN 不擋', () => {
      const dir = repo('0002_danger.sql', UNSAFE_SQL);
      // 再疊一個無關 commit，讓 0002 落在 HEAD~1 之前 → 變成 pre-existing
      fs.writeFileSync(path.join(dir, 'migrations/0003_noop.sql'), 'SELECT 1;\n');
      execSync('git add -A && git commit -q -m later', { cwd: dir, stdio: 'pipe' });
      const r = runGate(dir, ['--since=HEAD~1']);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain('PRE-EXISTING UNSAFE');
      // 訊息不能宣稱「已套用到 prod」—— 本 script 從不查 d1_migrations，不知道。
      expect(r.stdout).not.toContain('Already applied to prod');
      expect(r.stdout).toContain('未對 d1_migrations 查證');
    });

    it('無 --since（本機掃全部）→ 全部當 NEW，不安全就紅', () => {
      const r = runGate(repo('0002_danger.sql', UNSAFE_SQL), []);
      expect(r.code).toBe(1);
    });

    it('多行 FOREIGN KEY ... REFERENCES ... ON DELETE CASCADE 也要認得', () => {
      // 完全合法的 SQL 寫法。逐行 grep 抓不到 → CASCADE_PARENTS 空 → 「無 CASCADE
      // 關聯」→ exit 0，即使同一個 push 就在 DROP 那張 parent table。
      const r = runGate(
        repo('0002_danger.sql', UNSAFE_SQL, BASELINE_MULTILINE_SQL),
        ['--since=HEAD~1'],
      );
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('UNSAFE NEW');
    });

    it('一次 push 推多個 commit → 不在最後一格的 migration 也要看得見', () => {
      // GitHub 的 rebase-merge 會讓 master 一次前進多格（此 repo 三種策略都開著）。
      // 固定回看一格的 origin/master~1 會漏掉前面幾格 → 誤判成 pre-existing → 放行。
      // deploy.yml 因此改用 github.event.before（真正的 push 前 tip）。
      const dir = repo('0002_danger.sql', UNSAFE_SQL); // 不安全的在 HEAD~2
      const before = execSync('git rev-parse HEAD~1', { cwd: dir, encoding: 'utf8' }).trim();
      fs.writeFileSync(path.join(dir, 'migrations/0003_noop.sql'), 'SELECT 1;\n');
      execSync('git add -A && git commit -q -m later', { cwd: dir, stdio: 'pipe' });

      // 回看一格（舊行為）→ 看不到 0002 → 放行
      expect(runGate(dir, ['--since=HEAD~1']).code).toBe(0);
      // 用真正的 push-before（新行為）→ 抓到
      const r = runGate(dir, [`--since=${before}`]);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('UNSAFE NEW');
    });
  });

  describe('合法但不是「裸小寫單行」的 DROP —— 下面每一條都真的繞過過這個 gate', () => {
    // sqlite3 3.51.0 實跑確認：每一種寫法都被接受，且 CASCADE 照樣把 children 砍光。
    // 舊 gate 是逐行、大小寫敏感、只認裸識別字的 grep，所以全部 exit 0 放行。
    const EVASIONS: Array<[string, string]> = [
      ['雙引號識別字', 'DROP TABLE "trips";'],
      ['中括號識別字', 'DROP TABLE [trips];'],
      ['反引號識別字', 'DROP TABLE `trips`;'],
      ['小寫關鍵字', 'drop table trips;'],
      ['schema 前綴', 'DROP TABLE main.trips;'],
      ['分號換到下一行', 'DROP TABLE trips\n;'],
      ['IF EXISTS 後換行', 'DROP TABLE IF EXISTS\n  trips;'],
      ['結尾沒有分號', 'DROP TABLE trips'],
      ['註解假稱不需要 backup', '-- no _backup_trips needed, table is empty\nDROP TABLE trips;'],
      ['註解提到別人的 _backup_', '-- see 0047 _backup_trip_days pattern (n/a here)\nDROP TABLE trips;'],
      ['區塊註解藏 _backup_', '/* _backup_trips handled elsewhere */\nDROP TABLE trips;'],
    ];

    it.each(EVASIONS)('%s → 仍要 exit 1', (_label, sql) => {
      const r = runGate(repo('0002_evade.sql', `${sql}\n`), ['--since=HEAD~1']);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('UNSAFE NEW');
    });

    it('表名帶數字：CASCADE 偵測的字元類漏數字會保護到一張幽靈表', () => {
      // 這不是假想。真實 corpus 的 trip_docs_v2（0019_normalize_docs.sql:5 建表、
      // :16 掛 CASCADE child）被 [a-z_]+ 截成 trip_docs_v —— 一張不存在的表。
      // gate 因此保護著幽靈，真正有 CASCADE child 的 trip_docs_v2 全無防護。
      const r = runGate(
        repo('0002_drop_v2.sql', 'DROP TABLE trip_docs_v2;\n', BASELINE_DIGIT_SQL),
        ['--since=HEAD~1'],
      );
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('trip_docs_v2');
    });

    it('DROP TABLE trips_new 不可以被當成 DROP TABLE trips（正控：尾錨還在）', () => {
      // 0047 的 swap idiom 會 DROP TABLE IF EXISTS trips_new;。誤擋它 = gate 對所有
      // 走 swap 的 migration 都紅，然後大家開始習慣忽略它。
      const r = runGate(repo('0002_swap.sql', 'DROP TABLE IF EXISTS trips_new;\n'), ['--since=HEAD~1']);
      expect(r.code).toBe(0);
    });

    it('被擋下的 migration 改個編號不能就此洗白', () => {
      // 編號衝突改名是這裡的日常操作。--diff-filter=AM 會把 rename 濾掉 →
      // 從 NEW_FILES 消失 → 判成 pre-existing → WARN → 套用。內容一個字沒改。
      const dir = repo('0087_danger.sql', UNSAFE_SQL);
      const before = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim();
      execSync('git mv migrations/0087_danger.sql migrations/0088_danger.sql', { cwd: dir, stdio: 'pipe' });
      execSync('git commit -q -am renumber', { cwd: dir, stdio: 'pipe' });
      const r = runGate(dir, [`--since=${before}`]);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('0088_danger.sql');
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
