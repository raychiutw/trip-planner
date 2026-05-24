/**
 * round8c-scripts-polish.test.ts — v2.33.51 scripts/ round 8c final polish
 *
 * Source-grep guard for 5 個 fix:
 *  1. apply-patch.sh 拔 `set -a; source $ENV_PATH` RCE → node helper parse + 0600 check
 *  2. tripline-api-server.ts .env parser 對齊 lib/load-env.js (quote strip + key validate)
 *  3. dump-d1.js backup dir mode 0700 + 個別 file mode 0600 (PII)
 *  4. daily-check.js npm audit maxBuffer 32MB (拔 ENOBUFS)
 *  5. google-poi-refresh-30d.ts firstCall = false 在 finally (拔 firstCall stuck true bug)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const APPLY_PATCH_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/mac-mini-cron-patch/apply-patch.sh'),
  'utf-8',
);
const API_SERVER_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/tripline-api-server.ts'),
  'utf-8',
);
const DUMP_D1_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/dump-d1.js'),
  'utf-8',
);
const DAILY_CHECK_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/daily-check.js'),
  'utf-8',
);
const POI_REFRESH_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/google-poi-refresh-30d.ts'),
  'utf-8',
);

describe('v2.33.51 round 8c — apply-patch.sh RCE fix', () => {
  it('拔掉 `set -a; source $ENV_PATH` 模式', () => {
    // 確保 source 不再用於 .env (defense — 也許 source 其他 .sh files 是 OK)
    expect(APPLY_PATCH_SRC).not.toMatch(/set -a; source "\$ENV_PATH"/);
  });

  it('改用 node helper parse + key shell-safe regex', () => {
    expect(APPLY_PATCH_SRC).toContain("ENV_LINES=$(node -e");
    expect(APPLY_PATCH_SRC).toContain('A-Za-z_][A-Za-z0-9_]*');
  });

  it('stat .env file mode；非 0600/0400 → abort', () => {
    expect(APPLY_PATCH_SRC).toContain('stat');
    expect(APPLY_PATCH_SRC).toMatch(/mode is \$ENV_MODE.*0600/);
  });
});

describe('v2.33.51 round 8c — tripline-api-server.ts .env parser unified', () => {
  it('quote strip + key validate (對齊 sister scripts)', () => {
    expect(API_SERVER_SRC).toContain('val.slice(1, -1)');
    expect(API_SERVER_SRC).toMatch(/\/\^\[A-Za-z_\]\[A-Za-z0-9_\]\*\$\//);
  });

  it('strip 雙 + 單 quote (對齊 lib/load-env.js)', () => {
    expect(API_SERVER_SRC).toContain("val.startsWith('\"')");
    expect(API_SERVER_SRC).toContain("val.startsWith(\"'\")");
  });
});

describe('v2.33.51 round 8c — dump-d1.js backup permissions', () => {
  it('backup dir mode 0700 (owner only)', () => {
    expect(DUMP_D1_SRC).toContain('mode: 0o700');
    expect(DUMP_D1_SRC).toContain('chmodSync(backupDir, 0o700)');
  });

  it('個別 JSON file mode 0600', () => {
    expect(DUMP_D1_SRC).toContain('{ mode: 0o600 }');
  });
});

describe('v2.33.51 round 8c — daily-check.js npm audit maxBuffer', () => {
  it('npm audit execSync 加 maxBuffer 32MB', () => {
    expect(DAILY_CHECK_SRC).toContain('maxBuffer: 32 * 1024 * 1024');
  });
});

describe('v2.33.91 simplify — google-poi-refresh-30d batched parallel + first-batch 401 check', () => {
  // v2.33.91: 從 sequential for-of + firstCall finally pattern (v2.33.51 round 8c)
  // 改 batched Promise.allSettled。`isFirstBatch` 取代 `firstCall`，401 偵測仍生效。
  it('用 batched parallel via Promise.allSettled', () => {
    expect(POI_REFRESH_SRC).toMatch(/Promise\.allSettled/);
  });

  it('first batch 401 detection 仍生效 (autoplan T15 regression)', () => {
    expect(POI_REFRESH_SRC).toMatch(/isFirstBatch.*401|Unauthorized/);
    expect(POI_REFRESH_SRC).toContain('GOOGLE_MAPS_API_KEY rejected');
  });
});
