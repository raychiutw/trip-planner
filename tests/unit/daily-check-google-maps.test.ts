/**
 * daily-check.js — Google Maps free-tier headroom section
 *
 * v2.46.x: 2025/3 起 Maps 取消 $200 月抵免，改每個 SKU 各自免費月額度。本專案
 * 用量全在免費額度內 → 真實花費 $0。監控改「每個 SKU 用掉免費額度的 %」（headroom），
 * 在跨入付費前預警。用量來自 GCP Cloud Monitoring per-method MTD counts。
 *
 * 已刪除：calcMtdCost（dailyCost × dayOfMonth 投射）、calcCost（$ MTD vs $200）。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as quotaLib from '../../scripts/lib/google-maps-quota';
import {
  FREE_CAP,
  PRICE_PER_1K,
  WARN_PCT,
  calcHeadroom,
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

const ROUTES = 'google.maps.routing.v2.Routes.ComputeRoutes';
const SEARCH = 'google.maps.places.v1.Places.SearchText';

describe('google-maps-quota helper (pure)', () => {
  describe('FREE_CAP / PRICE_PER_1K tables', () => {
    it('caps and prices cover the same 6 method SKUs', () => {
      expect(Object.keys(FREE_CAP).sort()).toEqual(Object.keys(PRICE_PER_1K).sort());
      expect(Object.keys(FREE_CAP)).toContain(ROUTES);
      expect(Object.keys(FREE_CAP)).toContain(SEARCH);
    });

    it('stays in sync with google-quota-monitor.ts SoT (drift detection)', () => {
      // Both tables are duplicated in the orphan monitor; the source must
      // contain each method key with the same cap & price value.
      for (const [method, cap] of Object.entries(FREE_CAP)) {
        expect(QUOTA_MONITOR_SRC, `cap drift: ${method}`).toContain(`'${method}': ${cap}`);
      }
      for (const [method, price] of Object.entries(PRICE_PER_1K)) {
        expect(QUOTA_MONITOR_SRC, `price drift: ${method}`).toContain(`'${method}': ${price}`);
      }
    });
  });

  describe('calcHeadroom', () => {
    it('computes per-SKU % of free cap, identifies worst, $0 overage under cap', () => {
      const h = calcHeadroom([
        { method: ROUTES, count: 4813 }, // 48.13% of 10k
        { method: SEARCH, count: 384 }, // 3.84% of 10k
      ]);
      expect(h.maxPct).toBeCloseTo(48.13, 2);
      expect(h.worst.method).toBe(ROUTES);
      expect(h.overageCostTotal).toBe(0); // all within free tier
    });

    it('prices only the overage above the free cap', () => {
      // SearchText is Enterprise tier → 1,000 free. 12,000 − 1,000 = 11,000 paid
      // × $32/1k = $352.
      const h = calcHeadroom([{ method: SEARCH, count: 12000 }]);
      expect(h.maxPct).toBeCloseTo(1200, 5);
      expect(h.overageCostTotal).toBeCloseTo(352, 5);
    });

    it('ignores unknown method (no cap) for headroom', () => {
      const h = calcHeadroom([{ method: 'billingbudgets.unknown', count: 999 }]);
      expect(h.maxPct).toBe(0);
      expect(h.worst).toBeNull();
      expect(h.overageCostTotal).toBe(0);
    });

    it('returns zero state for empty list', () => {
      const h = calcHeadroom([]);
      expect(h.maxPct).toBe(0);
      expect(h.overageCostTotal).toBe(0);
    });
  });

  describe('removed obsolete cost functions (regression lock)', () => {
    it('does NOT export calcMtdCost (projection) or calcCost ($ vs $200 budget)', () => {
      const lib = quotaLib as Record<string, unknown>;
      expect(lib.calcMtdCost).toBeUndefined();
      expect(lib.calcCost).toBeUndefined();
    });

    it('exports the headroom API only', () => {
      const names = Object.keys(quotaLib).filter((k) => k !== 'default').sort();
      expect(names).toEqual(['FREE_CAP', 'PRICE_PER_1K', 'WARN_PCT', 'calcHeadroom', 'classifyStatus']);
    });
  });

  describe('classifyStatus (headroom % of free cap)', () => {
    it('critical when maxPct ≥ critical threshold', () => {
      expect(classifyStatus(90, 90)).toBe('critical');
      expect(classifyStatus(100, 90)).toBe('critical');
    });

    it(`warning when ${WARN_PCT}% ≤ maxPct < critical`, () => {
      expect(classifyStatus(WARN_PCT, 90)).toBe('warning');
      expect(classifyStatus(85, 90)).toBe('warning');
      expect(classifyStatus(89.99, 90)).toBe('warning');
    });

    it('ok when maxPct < warn threshold (e.g. Routes at 48%)', () => {
      expect(classifyStatus(0, 90)).toBe('ok');
      expect(classifyStatus(48.13, 90)).toBe('ok');
      expect(classifyStatus(WARN_PCT - 0.01, 90)).toBe('ok');
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

  it('computes free-tier headroom (no $ projection)', () => {
    expect(DAILY_CHECK_SRC).toMatch(/calcHeadroom\(/);
    expect(DAILY_CHECK_SRC).not.toMatch(/calcMtdCost\s*\(/);
    expect(DAILY_CHECK_SRC).not.toMatch(/calcCost\s*\(/);
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
