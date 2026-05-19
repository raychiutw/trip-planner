/**
 * daily-check.js — Google Maps quota section (v2.31.96)
 *
 * 把 scripts/google-quota-monitor.ts 的 cost 計算邏輯抽到 lib/google-maps-quota.js
 * 共用，daily-check.js 新增 7th section 透過 `/api/admin/quota-estimate` +
 * `/api/admin/maps-settings` 算 MTD，threshold (≥lock_threshold_pct → critical;
 * ≥50% → warning; <50% → ok) 對齊 quota-monitor.ts hysteresis 設計。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  PRICE_PER_1K,
  calcDailyCost,
  calcMtdCost,
  classifyStatus,
} from '../../scripts/lib/google-maps-quota';

const DAILY_CHECK_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../scripts/daily-check.js'),
  'utf8',
);

const QUOTA_MONITOR_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../scripts/google-quota-monitor.ts'),
  'utf8',
);

describe('google-maps-quota helper (pure)', () => {
  describe('PRICE_PER_1K', () => {
    it('exports the 6 expected services', () => {
      expect(Object.keys(PRICE_PER_1K).sort()).toEqual([
        'autocomplete',
        'directions',
        'geocoding',
        'maps_js',
        'place_details',
        'search_text',
      ]);
    });

    it('matches quota-monitor.ts source values (single SoT, drift detection)', () => {
      // Pulls per-service price lines from quota-monitor.ts and verifies the
      // helper module mirrors them — if quota-monitor.ts changes prices the
      // test fails until lib/google-maps-quota.js is updated to match.
      const re = /(\w+):\s*([\d.]+),\s*\/\/\s*([^\n]+)/g;
      const monitorPrices: Record<string, number> = {};
      let m: RegExpExecArray | null;
      while ((m = re.exec(QUOTA_MONITOR_SRC)) !== null) {
        const [, key, value] = m;
        if (key in PRICE_PER_1K) monitorPrices[key] = Number(value);
      }
      expect(monitorPrices).toEqual(PRICE_PER_1K);
    });
  });

  describe('calcDailyCost', () => {
    it('sums per-service (count_24h / 1000) × price', () => {
      const estimates = [
        { service: 'search_text', count_24h: 1000 }, // $32
        { service: 'place_details', count_24h: 100 }, // $1.70
        { service: 'directions', count_24h: 500 }, // $2.50
      ];
      // 32 + 1.7 + 2.5 = 36.2
      expect(calcDailyCost(estimates)).toBeCloseTo(36.2, 5);
    });

    it('ignores unknown service (price=0 fallback)', () => {
      const estimates = [
        { service: 'search_text', count_24h: 1000 },
        { service: 'unknown_service', count_24h: 10000 },
      ];
      expect(calcDailyCost(estimates)).toBeCloseTo(32, 5);
    });

    it('returns 0 for empty list', () => {
      expect(calcDailyCost([])).toBe(0);
    });
  });

  describe('calcMtdCost', () => {
    it('multiplies daily cost by dayOfMonth', () => {
      const estimates = [{ service: 'search_text', count_24h: 1000 }]; // $32/day
      expect(calcMtdCost(estimates, 5)).toBeCloseTo(160, 5);
      expect(calcMtdCost(estimates, 1)).toBeCloseTo(32, 5);
      expect(calcMtdCost(estimates, 31)).toBeCloseTo(992, 5);
    });
  });

  describe('classifyStatus', () => {
    it('critical when mtdPct ≥ lockThresholdPct', () => {
      expect(classifyStatus(90, 90)).toBe('critical');
      expect(classifyStatus(95, 90)).toBe('critical');
      expect(classifyStatus(100, 90)).toBe('critical');
    });

    it('warning when 50 ≤ mtdPct < lockThresholdPct', () => {
      expect(classifyStatus(50, 90)).toBe('warning');
      expect(classifyStatus(70, 90)).toBe('warning');
      expect(classifyStatus(89.99, 90)).toBe('warning');
    });

    it('ok when mtdPct < 50', () => {
      expect(classifyStatus(0, 90)).toBe('ok');
      expect(classifyStatus(49, 90)).toBe('ok');
      expect(classifyStatus(49.99, 90)).toBe('ok');
    });
  });
});

describe('daily-check.js — Google Maps section wiring', () => {
  it('imports lib/google-maps-quota helper', () => {
    expect(DAILY_CHECK_SRC).toMatch(/require\(['"]\.\/lib\/google-maps-quota['"]\)/);
  });

  it('defines queryGoogleMapsQuota async function', () => {
    expect(DAILY_CHECK_SRC).toMatch(/async function queryGoogleMapsQuota\(/);
  });

  it('fetches /api/admin/quota-estimate', () => {
    expect(DAILY_CHECK_SRC).toContain('/api/admin/quota-estimate');
  });

  it('fetches /api/admin/maps-settings', () => {
    expect(DAILY_CHECK_SRC).toContain('/api/admin/maps-settings');
  });

  it('wires googleMapsQuota into Promise.allSettled (7th source)', () => {
    expect(DAILY_CHECK_SRC).toMatch(/queryGoogleMapsQuota\(\)/);
  });

  it('includes googleMapsQuota in report object', () => {
    expect(DAILY_CHECK_SRC).toMatch(/googleMapsQuota:\s*googleMapsQuota/);
  });

  it('feeds googleMapsQuota into calcSummary (impacts critical/warning counts)', () => {
    expect(DAILY_CHECK_SRC).toMatch(/calcSummary\([^)]*googleMapsQuota[^)]*\)/);
  });
});
