/**
 * #1675 守門：舊入口（網站網域 /api）退役後，腳本不得再預設打網站網域。
 * - qa-email-flows.sh 保留：預設 base 為新 api staging，打 production 需明確環境變數。
 * - poi-favorites-rename 一次性 smoke、seed-demo-account（cookie 登入＋內嵌密碼）已刪除，不得再被引用。
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const QA = 'scripts/qa-email-flows.sh';
const STAGING = 'https://trip-planner-api.lean-lean.workers.dev';
const PRODUCTION = 'https://trip-planner-api-production.lean-lean.workers.dev';

// 假 curl 置於 PATH 最前：測試絕不真的發出網路請求（紅燈階段腳本尚未擋 production 時也不會打出去）。
const stubDir = mkdtempSync(resolve(tmpdir(), 'qa-stub-'));
writeFileSync(resolve(stubDir, 'curl'), '#!/bin/sh\necho "STUB_CURL_CALLED $*" >&2\nexit 7\n');
chmodSync(resolve(stubDir, 'curl'), 0o755);

function runQa(env: Record<string, string>, args: string[] = []) {
  // 只傳指定 env（不繼承外部 TRIPLINE_QA_*）；被擋的路徑在發任何 curl 前就 exit 2。
  const clean = { PATH: `${stubDir}:${process.env.PATH ?? ''}`, ...env };
  return spawnSync('bash', [resolve(root, QA), ...args], { env: clean, encoding: 'utf-8', timeout: 10_000 });
}

describe('qa-email-flows.sh', () => {
  const src = readFileSync(resolve(root, QA), 'utf-8');

  it('預設 base 是新 api staging，不是網站網域', () => {
    const m = src.match(/^BASE="\$\{TRIPLINE_QA_BASE:-([^}]+)\}"/m);
    expect(m?.[1]).toBe(STAGING);
  });

  it('拒絕網站網域作為 base（落到 SPA 會回 200 html 而誤判）', () => {
    const r = runQa({ TRIPLINE_QA_BASE: 'https://trip-planner-dby.pages.dev' });
    expect(r.status).toBe(2);
  });

  it('production 沒有明確環境變數就拒絕', () => {
    expect(runQa({ TRIPLINE_QA_BASE: PRODUCTION }).status).toBe(2);
    expect(runQa({}, ['--base', PRODUCTION]).status).toBe(2);
  });

  it('--send（會寄真信）打 production 即使有允許變數也拒絕', () => {
    const r = runQa({ TRIPLINE_QA_ALLOW_PRODUCTION: '1' }, ['--base', PRODUCTION, '--send']);
    expect(r.status).toBe(2);
  });

  it('不內嵌 token／密碼', () => {
    expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{20,}|password\s*[:=]\s*['"]?[^\s'"$]{4,}/i);
  });
});

describe('已刪除的舊入口腳本', () => {
  const gone = ['scripts/smoke/poi-favorites-rename-post-deploy.sh', 'scripts/seed-demo-account.mjs'];

  it.each(gone)('%s 不存在', (p) => {
    expect(existsSync(resolve(root, p))).toBe(false);
  });

  it('現行檔案（package.json、workflows、文件、腳本）不再引用', () => {
    const r = spawnSync(
      'git',
      ['grep', '-nE', 'seed-demo-account|poi-favorites-rename-post-deploy', '--', 'package.json', '.github', 'scripts', 'CLAUDE.md', 'CONTRIBUTING.md', 'README.md'],
      { cwd: root, encoding: 'utf-8' },
    );
    expect(r.stdout).toBe('');
  });
});
