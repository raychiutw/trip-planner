/**
 * round5c-security.test.ts — v2.33.43 security audit final batch
 *
 * 純 unit-style source-grep tests（避開複雜 oauth / batch session 設置）。
 * 驗證 3 個 fix wiring:
 *  1. middleware checkCsrf Bearer 也走 Origin check (defense in depth)
 *  2. entries/[eid].ts catch 對 UNIQUE / FK constraint re-classify 為 409
 *  3. trip-pois.ts INSERT + UPDATE entry_pois_version 進 db.batch (atomic)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MIDDLEWARE_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/_middleware.ts'),
  'utf-8',
);
const ENTRY_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/trips/[id]/entries/[eid].ts'),
  'utf-8',
);
const TRIP_POIS_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/trips/[id]/entries/[eid]/trip-pois.ts'),
  'utf-8',
);

describe('v2.33.43 round 5c — middleware Bearer CSRF defense in depth', () => {
  it('Bearer 走 Origin allowlist check (如有 Origin)', () => {
    // 必須有「hasBearer」+「if (origin && !isAllowedOrigin」搭配
    expect(MIDDLEWARE_SRC).toMatch(/const\s+hasBearer/);
    const bearerBlock = MIDDLEWARE_SRC.match(/if \(hasBearer\)[\s\S]*?return null;\s*\}/);
    expect(bearerBlock).not.toBeNull();
    expect(bearerBlock?.[0]).toMatch(/isAllowedOrigin\(origin, env\)/);
  });

  it('comment 標 v2.33.43 audit context', () => {
    expect(MIDDLEWARE_SRC).toMatch(/v2\.33\.43.+Bearer/);
  });
});

describe('v2.33.43 round 5c — entries/[eid] catch re-classify', () => {
  it('PATCH catch UNIQUE → DATA_CONFLICT (409)', () => {
    const patchCatchBlock = ENTRY_SRC.match(/UPDATE trip_entries[\s\S]*?DATA_CONFLICT[\s\S]*?DATA_VALIDATION/);
    expect(patchCatchBlock).not.toBeNull();
    expect(patchCatchBlock?.[0]).toMatch(/UNIQUE constraint/);
    expect(patchCatchBlock?.[0]).toMatch(/FOREIGN KEY constraint/);
  });

  it('DELETE catch FK → DATA_CONFLICT (409)', () => {
    const deleteCatchBlock = ENTRY_SRC.match(/DELETE FROM trip_entries[\s\S]*?DATA_CONFLICT/);
    expect(deleteCatchBlock).not.toBeNull();
    expect(deleteCatchBlock?.[0]).toMatch(/FOREIGN KEY constraint/);
  });
});

describe('v2.33.43 round 5c — trip-pois.ts atomic batch', () => {
  it('INSERT + UPDATE entry_pois_version 同 db.batch([...])', () => {
    expect(TRIP_POIS_SRC).toMatch(/db\.batch\(\[/);
    expect(TRIP_POIS_SRC).toMatch(/INSERT INTO trip_entry_pois/);
    expect(TRIP_POIS_SRC).toMatch(/entry_pois_version = entry_pois_version \+ 1/);
    // 必須在同個 batch array 內（不是 await db.batch then await separate UPDATE）
    const batchBlock = TRIP_POIS_SRC.match(/db\.batch\(\[[\s\S]*?\]\)/);
    expect(batchBlock).not.toBeNull();
    expect(batchBlock?.[0]).toMatch(/INSERT INTO trip_entry_pois/);
    expect(batchBlock?.[0]).toMatch(/UPDATE trip_entries SET entry_pois_version/);
  });

  it('UNIQUE handling 留住（rollback 後 re-classify）', () => {
    expect(TRIP_POIS_SRC).toMatch(/此 POI 已存在於該 entry/);
    expect(TRIP_POIS_SRC).toMatch(/同時新增 POI 衝突/);
  });
});
