/**
 * trip-page-no-trip-driving-stats.test.ts — R19 TDD red test
 *
 * 驗證 TripPage.tsx 不再計算或傳遞 tripDrivingStats（全旅程交通統計）。
 * 交通資訊改由 Timeline 內各 entry 的 travel 物件呈現（R19）。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const tripPagePath = join(process.cwd(), 'src', 'pages', 'TripPage.tsx');
const src = readFileSync(tripPagePath, 'utf-8');

describe('TripPage — 移除 tripDrivingStats (R19)', () => {
  it('不 import calcTripDrivingStats', () => {
    const match = src.match(/import\s*\{[^}]*calcTripDrivingStats[^}]*\}\s*from\s+['"][^'"]*drivingStats['"]/);
    expect(match).toBeNull();
  });

  it('不宣告或傳遞 tripDrivingStats（涵蓋 useMemo、prop、參數等所有用法）', () => {
    const match = src.match(/\btripDrivingStats\b/);
    expect(match).toBeNull();
  });
});
