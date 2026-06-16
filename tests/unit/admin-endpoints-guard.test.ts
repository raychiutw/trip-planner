/**
 * admin-endpoints-guard.test.ts — Round 24 (v2.33.74)
 *
 * Round 15 finding: 8 個 `functions/api/admin/*.ts` endpoint 缺 unit-level
 * security guard 驗證。Miniflare port exhaustion 使 71 個 integration test
 * 無法穩定平行跑，改 source-grep 模式驗：
 *   1. 每個 admin endpoint 一定 import + 呼叫 requireScope（Phase 1：移除全域 admin，改 ops scope）
 *   2. 狀態變動 endpoint 一定有 audit log（maps-lock / maps-unlock）
 *   3. 沒有 fall-through「無 auth 就 export」
 *
 * 較弱於 integration coverage 但**穩定 + 抓得到 regression**（如 v2.31.16
 * 家族:漏 guard / 漏 audit）。Integration test 留 sandbox 本機跑。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_DIR = join(process.cwd(), 'functions/api/admin');
const ADMIN_FILES = readdirSync(ADMIN_DIR).filter((f) => f.endsWith('.ts'));

// 期待清單 — 抓 file rename / 漏檔
const EXPECTED_ADMIN_ENDPOINTS = [
  'backfill-status.ts',
  'cache-cleanup.ts',
  'maps-lock.ts',
  'maps-settings.ts',
  'maps-unlock.ts',
  'pois-due-refresh.ts',
  'pois-pending-place-id.ts',
  'quota-estimate.ts',
];

// 狀態變動 endpoint — 必須額外有 audit log（maps-settings 是 GET-only 不算）
const STATEFUL_ADMIN_ENDPOINTS = ['maps-lock.ts', 'maps-unlock.ts'];

describe('Round 24 — admin endpoints inventory', () => {
  it('admin dir 包含全部預期 endpoint，無漏檔', () => {
    for (const expected of EXPECTED_ADMIN_ENDPOINTS) {
      expect(ADMIN_FILES, `${expected} missing from functions/api/admin/`).toContain(expected);
    }
  });
});

describe('Round 24 — admin endpoints require ops-scope guard', () => {
  for (const file of EXPECTED_ADMIN_ENDPOINTS) {
    it(`${file} import + 呼叫 requireScope`, () => {
      const src = readFileSync(join(ADMIN_DIR, file), 'utf-8');
      expect(src, `${file} 缺 _auth import`).toMatch(/from\s+['"][^'"]*_auth['"]/);
      expect(src, `${file} 缺 requireScope import name`).toMatch(/requireScope/);
      // 至少一次 call (不只是 import — 防 dead import)
      const callMatches = src.match(/requireScope\s*\(/g);
      expect(callMatches, `${file} requireScope import 但沒 call`).not.toBeNull();
      expect((callMatches || []).length).toBeGreaterThanOrEqual(1);
    });
  }
});

describe('Round 24 — stateful admin endpoints write audit log', () => {
  for (const file of STATEFUL_ADMIN_ENDPOINTS) {
    it(`${file} 寫 audit log（logAudit call）`, () => {
      const src = readFileSync(join(ADMIN_DIR, file), 'utf-8');
      expect(src, `${file} 缺 logAudit import`).toMatch(/logAudit/);
      const callMatches = src.match(/logAudit\s*\(/g);
      expect(callMatches, `${file} logAudit import 但沒 call`).not.toBeNull();
    });
  }
});

describe('Round 24 — admin endpoints export PagesFunction handler', () => {
  for (const file of EXPECTED_ADMIN_ENDPOINTS) {
    it(`${file} export onRequest* PagesFunction<Env>`, () => {
      const src = readFileSync(join(ADMIN_DIR, file), 'utf-8');
      expect(src).toMatch(/export\s+const\s+onRequest(Get|Post|Put|Patch|Delete)?\s*:\s*PagesFunction<Env>/);
    });
  }
});
