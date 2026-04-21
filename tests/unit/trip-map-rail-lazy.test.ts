/**
 * trip-map-rail-lazy.test.ts — F005 TDD test
 *
 * 驗證 TripPage.tsx 使用 React.lazy 載入 TripMapRail，
 * 確保 Leaflet 重型套件不影響首頁 bundle size。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const TRIP_PAGE_SRC = resolve(__dirname, '../../src/pages/TripPage.tsx');
const source = readFileSync(TRIP_PAGE_SRC, 'utf-8');

describe('F005 — TripMapRail React.lazy', () => {
  it('TripPage 使用 lazy() 載入 TripMapRail', () => {
    expect(source).toMatch(/lazy\(\s*\(\s*\)\s*=>\s*import\s*\(/);
  });

  it('TripPage 的 lazy import 包含 TripMapRail', () => {
    expect(source).toMatch(/lazy.*TripMapRail|TripMapRail.*lazy/s);
  });

  it('TripPage 有 Suspense 包住 lazy component', () => {
    expect(source).toContain('Suspense');
  });
});
