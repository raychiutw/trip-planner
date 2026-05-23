/**
 * round8a-scripts-security.test.ts — v2.33.49 round 8a scripts hardening
 *
 * Source-grep guard for 6 個 fix:
 *  1. api-server skillCommand allowlist
 *  2. tripline-job.sh .env strip quotes + exit 1 on unreachable
 *  3. get-tripline-token.js 用 shared loadEnvLocal
 *  4. _lib/cron-shared.ts quote-strip 對齊 lib/load-env.js
 *  5. smoke poi-favorites-rename `set -euo pipefail`
 *  6. send-telegram.sh TOKEN format validation
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const API_SERVER_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/tripline-api-server.ts'),
  'utf-8',
);
const JOB_SH_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/tripline-job.sh'),
  'utf-8',
);
const TOKEN_HELPER_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/lib/get-tripline-token.js'),
  'utf-8',
);
const CRON_SHARED_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/_lib/cron-shared.ts'),
  'utf-8',
);
const SMOKE_SH_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/smoke/poi-favorites-rename-post-deploy.sh'),
  'utf-8',
);
const TELEGRAM_SH_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/lib/send-telegram.sh'),
  'utf-8',
);

describe('v2.33.49 round 8a — api-server skillCommand allowlist', () => {
  it('ALLOWED_SKILLS Set 含 /tp-request + /tp-daily-check', () => {
    expect(API_SERVER_SRC).toMatch(/ALLOWED_SKILLS\s*=\s*new Set\(\[['"]\/tp-request['"],\s*['"]\/tp-daily-check['"]/);
  });

  it('assertAllowedSkill 在 sessionPrefixForSkill / spawnTmuxRequest / processLoop 都 gate', () => {
    expect(API_SERVER_SRC).toMatch(/function assertAllowedSkill/);
    expect(API_SERVER_SRC.match(/assertAllowedSkill\(/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('v2.33.49 round 8a — tripline-job.sh env hardening', () => {
  it('quote strip wrapper present (both double + single)', () => {
    expect(JOB_SH_SRC).toContain('${value:1:${#value}-2}');
    // Check both arms exist
    expect(JOB_SH_SRC).toContain('^\\".*\\"$');
    expect(JOB_SH_SRC).toContain("^\\'.*\\'$");
  });

  it('key validate against shell-safe regex', () => {
    expect(JOB_SH_SRC).toContain('[A-Za-z_][A-Za-z0-9_]*');
  });

  it('API server unreachable → exit 1 (不 mask outage)', () => {
    const idx = JOB_SH_SRC.indexOf('API server 不可用');
    expect(idx).toBeGreaterThan(-1);
    const after = JOB_SH_SRC.slice(idx, idx + 300);
    expect(after).toContain('exit 1');
    // 注意 comment 內 'exit 0' 是說明 — 行動 statement 要 exit 1
    // 後面 200 chars 內不能有未 prefix '#' 的 'exit 0'
    expect(after.split('\n').filter((l) => l.trim() === 'exit 0')).toHaveLength(0);
  });
});

describe('v2.33.49 round 8a — get-tripline-token.js shared parser', () => {
  it('使用 shared loadEnvLocal (拔 legacy inline regex)', () => {
    expect(TOKEN_HELPER_SRC).toMatch(/require\(['"]\.\/load-env['"]\)/);
    expect(TOKEN_HELPER_SRC).toMatch(/loadEnvLocal\(\)/);
    // 確認舊 regex pattern 不在
    expect(TOKEN_HELPER_SRC).not.toMatch(/line\.match\(\/\^\\\(w\+\)=/);
  });
});

describe('v2.33.49 round 8a — _lib/cron-shared.ts quote-strip', () => {
  it('支援 double + single quote strip', () => {
    // 用 substring contain 更穩
    expect(CRON_SHARED_SRC).toContain("val.startsWith('\"')");
    expect(CRON_SHARED_SRC).toContain("val.startsWith(\"'\")");
    expect(CRON_SHARED_SRC).toContain('val.slice(1, -1)');
  });

  it('key 過濾 shell-safe regex', () => {
    expect(CRON_SHARED_SRC).toContain('[A-Za-z_][A-Za-z0-9_]*');
  });
});

describe('v2.33.49 round 8a — smoke poi-favorites-rename set -e', () => {
  it('set -euo pipefail 全 enable', () => {
    expect(SMOKE_SH_SRC).toMatch(/set -euo pipefail/);
  });
});

describe('v2.33.49 round 8a — send-telegram TOKEN validation', () => {
  it('TOKEN format regex check', () => {
    expect(TELEGRAM_SH_SRC).toMatch(/\[0-9\]\+:\[A-Za-z0-9_-\]\+/);
    expect(TELEGRAM_SH_SRC).toMatch(/TELEGRAM_BOT_TOKEN 格式不合法/);
  });

  it('CHAT_ID 必須 numeric', () => {
    expect(TELEGRAM_SH_SRC).toMatch(/\^-\?\[0-9\]\+\$/);
  });
});
