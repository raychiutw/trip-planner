/**
 * round-15b-tests-quality.test.ts — v2.33.65 Round 15 tests/ quality fix
 *
 * Source-grep guard:
 *   1. vitest.config clearMocks + restoreMocks + setup-dom.js path
 *   2. playwright.config CI retries + workers
 *   3. 3 個 fake-timer file 加 afterEach restore
 *   4. timeline-rail-stale-travel setTimeout(0) → waitFor (anti-pattern fix)
 *   5. setup-dom.js (rename from setup-jest-dom.js)
 *   6. TripDestination type 改 camelCase 對齊 backend (v2.31.13 fix family)
 *   7. NewTripContext + ActiveTripContext outside-provider dev warn (round 15a 已 ship)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf-8');
const exists = (p: string) => existsSync(path.resolve(__dirname, '../..', p));

const VITEST_CONFIG = read('vitest.config.js');
const PLAYWRIGHT_CONFIG = read('playwright.config.js');
const MAPS_LOCK_TEST = read('tests/unit/maps-lock.test.ts');
const OAUTH_ADAPTER_TEST = read('tests/unit/oauth-d1-adapter.test.ts');
const SESSION_TEST = read('tests/unit/session-module.test.ts');
const TIMELINE_RAIL_TEST = read('tests/unit/timeline-rail-stale-travel.test.tsx');
const TRIP_TYPES = read('src/types/trip.ts');

describe('v2.33.65 #1 — vitest config clearMocks + restoreMocks + setup-dom rename', () => {
  it('clearMocks + restoreMocks enabled', () => {
    expect(VITEST_CONFIG).toMatch(/clearMocks: true/);
    expect(VITEST_CONFIG).toMatch(/restoreMocks: true/);
  });

  it('setup-dom.js renamed (not setup-jest-dom.js)', () => {
    expect(VITEST_CONFIG).toMatch(/setupFiles: \['\.\/tests\/setup-dom\.js'\]/);
    expect(exists('tests/setup-dom.js')).toBe(true);
    expect(exists('tests/setup-jest-dom.js')).toBe(false);
  });
});

describe('v2.33.65 #2 — playwright CI retries + workers', () => {
  it('retries: process.env.CI ? 2 : 0', () => {
    expect(PLAYWRIGHT_CONFIG).toMatch(/retries: process\.env\.CI \? 2 : 0/);
  });

  it('workers: process.env.CI ? 2 : 1', () => {
    expect(PLAYWRIGHT_CONFIG).toMatch(/workers: process\.env\.CI \? 2 : 1/);
  });
});

describe('v2.33.65 #3 — fake timer afterEach restore (3 files)', () => {
  it('maps-lock.test.ts afterEach vi.useRealTimers', () => {
    expect(MAPS_LOCK_TEST).toMatch(/afterEach\(\(\) => \{\s*vi\.useRealTimers\(\)/);
  });

  it('oauth-d1-adapter.test.ts afterEach vi.useRealTimers', () => {
    expect(OAUTH_ADAPTER_TEST).toMatch(/afterEach\(\(\) => \{\s*vi\.useRealTimers\(\)/);
  });

  it('session-module.test.ts afterEach vi.useRealTimers', () => {
    expect(SESSION_TEST).toMatch(/afterEach\(\(\) => \{\s*vi\.useRealTimers\(\)/);
  });
});

describe('v2.33.65 #4 — setTimeout(0) anti-pattern guard (timeline-rail-stale-travel)', () => {
  // v2.55.x 車程 pill 改被動 status chip 後，本檔手動重算 button 的 async 測試已移除，
  // chip 渲染純同步 → 不再需要 waitFor；原「改用 waitFor」正向斷言隨 async 測試一併退場，
  // 保留「不得重現 setTimeout(0) microtask-flush」防呆（仍是有效 regression guard）。
  it('拔掉 setTimeout(r, 0) anti-pattern', () => {
    expect(TIMELINE_RAIL_TEST).not.toMatch(/new Promise\(\(r\) => setTimeout\(r, 0\)\)/);
  });
});

describe('v2.33.65 #5 — TripDestination type 對齊 camelCase', () => {
  it('TripDestination 用 camelCase (destOrder / dayQuota / subAreas)', () => {
    expect(TRIP_TYPES).toMatch(/destOrder: number/);
    expect(TRIP_TYPES).toMatch(/dayQuota\?: number \| null/);
    expect(TRIP_TYPES).toMatch(/subAreas\?: string\[\] \| null/);
  });

  it('拔掉 snake_case (dest_order / day_quota / sub_areas)', () => {
    expect(TRIP_TYPES).not.toMatch(/^\s*dest_order: number/m);
    expect(TRIP_TYPES).not.toMatch(/^\s*day_quota\?:/m);
    expect(TRIP_TYPES).not.toMatch(/^\s*sub_areas\?:/m);
  });
});
