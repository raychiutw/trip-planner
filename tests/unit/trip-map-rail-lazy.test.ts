/**
 * trip-map-rail-lazy.test.ts — F005 TDD test
 *
 * 驗證 TripPage.tsx 使用 lazyWithRetry 載入 TripSheet（內部再 lazy 載
 * TripMapRail），確保 Leaflet 重型套件不影響首頁 bundle size。
 * lazyWithRetry 為共用 util（src/lib/lazyWithRetry.ts），在 deploy 後
 * 舊 chunk hash 失效時 retry + reload 自癒，避免 stale-chunk 進 Sentry。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const TRIP_PAGE_SRC = resolve(__dirname, '../../src/pages/TripPage.tsx');
const source = readFileSync(TRIP_PAGE_SRC, 'utf-8');

describe('F005 — TripMapRail React.lazy', () => {
  it('TripPage 使用 lazyWithRetry() 載入 lazy component', () => {
    expect(source).toMatch(/lazyWithRetry\(\s*\(\s*\)\s*=>\s*import\s*\(/);
  });

  it('TripPage 的 lazy import 與 TripMapRail 相關', () => {
    expect(source).toMatch(/lazyWithRetry.*TripMapRail|TripMapRail.*lazyWithRetry/s);
  });

  it('TripPage 有 Suspense 包住 lazy component', () => {
    expect(source).toContain('Suspense');
  });
});
