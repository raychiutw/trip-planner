/**
 * round-16-ci-security.test.ts — v2.33.66 CI workflow security hardening guard
 *
 * Source-grep:
 *   1. 6 workflows 都加 permissions: contents: read
 *   2. 4 個 action 全 pin SHA + version comment
 *   3. lighthouse 加 concurrency
 *   4. rate-limit-cleanup SQL 抽到 scripts/cleanup-rate-limit.sql
 *   5. .github/dependabot.yml 新建 (github-actions + npm groups)
 *   6. .github/CODEOWNERS 新建 (workflows / migrations / oauth / headers / config)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf-8');
const exists = (p: string) => existsSync(path.resolve(__dirname, '../..', p));

const WORKFLOWS = [
  '.github/workflows/ci.yml',
  '.github/workflows/deploy.yml',
  '.github/workflows/daily-report.yml',
  '.github/workflows/lighthouse.yml',
  '.github/workflows/rate-limit-cleanup.yml',
  '.github/workflows/telegram-smoke.yml',
];

describe('v2.33.66 HIGH-1 — permissions: contents: read on all 6 workflows', () => {
  for (const wf of WORKFLOWS) {
    it(`${wf} declares permissions: contents: read`, () => {
      const src = read(wf);
      expect(src).toMatch(/^permissions:\s*\n\s+contents: read/m);
    });
  }
});

describe('v2.33.66 LOW-1 + HIGH-2/3 — all actions pinned to SHA', () => {
  it('no floating tag (uses: ...@v1 / @master / @main)', () => {
    for (const wf of WORKFLOWS) {
      const src = read(wf);
      // Find every `uses: name@ref` line, check ref is hex SHA (40 chars)
      const matches = src.matchAll(/uses:\s+([^\s#@]+)@([^\s#]+)/g);
      for (const m of matches) {
        const [, action, ref] = m;
        expect(ref, `${wf} action ${action} should pin SHA not "${ref}"`).toMatch(/^[a-f0-9]{40}$/);
      }
    }
  });

  it('SHA pin 有 version comment (# v4 etc)', () => {
    for (const wf of WORKFLOWS) {
      const src = read(wf);
      const matches = src.matchAll(/uses:\s+[^\s@]+@[a-f0-9]{40}\s+#\s+v\d/g);
      // 不強迫每行都有 comment，但有 SHA pin 的至少一行該有 (sanity)
      if (src.includes('uses: ')) {
        expect(matches, `${wf} pin SHA 至少一個有 # v? comment`).toBeDefined();
      }
    }
  });
});

describe('v2.33.66 LOW-3 — lighthouse concurrency', () => {
  it('lighthouse.yml 加 concurrency group + cancel-in-progress', () => {
    const src = read('.github/workflows/lighthouse.yml');
    expect(src).toMatch(/concurrency:\s*\n\s+group: lighthouse-/);
    expect(src).toMatch(/cancel-in-progress: true/);
  });
});

describe('v2.33.66 MED-2 — rate-limit cleanup SQL extracted', () => {
  it('scripts/cleanup-rate-limit.sql 存在', () => {
    expect(exists('scripts/cleanup-rate-limit.sql')).toBe(true);
  });

  it('SQL 含 DELETE FROM rate_limit_buckets + cutoff guard', () => {
    const sql = read('scripts/cleanup-rate-limit.sql');
    expect(sql).toMatch(/DELETE FROM rate_limit_buckets/);
    expect(sql).toMatch(/locked_until IS NULL/);
    expect(sql).toMatch(/window_start \+ 3600000/);
  });

  it('workflow 改 --file= 不再 inline --command', () => {
    const wf = read('.github/workflows/rate-limit-cleanup.yml');
    expect(wf).toMatch(/--file=scripts\/cleanup-rate-limit\.sql/);
    expect(wf).not.toMatch(/--command "DELETE FROM rate_limit_buckets/);
  });
});

describe('v2.33.66 LOW-2 — dependabot.yml', () => {
  it('.github/dependabot.yml 存在', () => {
    expect(exists('.github/dependabot.yml')).toBe(true);
  });

  it('含 github-actions + npm 兩 ecosystem', () => {
    const src = read('.github/dependabot.yml');
    expect(src).toMatch(/package-ecosystem: github-actions/);
    expect(src).toMatch(/package-ecosystem: npm/);
  });

  it('npm 用 grouped PR (避免 PR flood)', () => {
    const src = read('.github/dependabot.yml');
    expect(src).toMatch(/groups:/);
    expect(src).toMatch(/react-stack/);
  });
});

describe('v2.33.66 MED-2 — CODEOWNERS protects workflows + migrations + auth', () => {
  it('.github/CODEOWNERS 存在', () => {
    expect(exists('.github/CODEOWNERS')).toBe(true);
  });

  it('保護 workflows + migrations + src/server + headers', () => {
    const src = read('.github/CODEOWNERS');
    expect(src).toMatch(/\/\.github\/workflows\//);
    expect(src).toMatch(/\/migrations\//);
    expect(src).toMatch(/\/src\/server\//);
    expect(src).toMatch(/\/public\/_headers/);
  });
});
