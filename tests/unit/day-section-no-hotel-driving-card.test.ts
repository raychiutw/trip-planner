/**
 * day-section-no-hotel-driving-card.test.ts — R19 TDD red test
 *
 * 驗證 DaySection.tsx 不再引入「住宿資訊」與「每日交通統計」兩個 card，
 * 該資訊應改由 Timeline 首 entry 與各 entry 的 travel 承載（R19，capability daily-first-stop）。
 *
 * 本測試為 source-level 檢查（讀檔 + regex），比 React render 測試穩定。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const daySectionPath = join(process.cwd(), 'src', 'components', 'trip', 'DaySection.tsx');
const src = readFileSync(daySectionPath, 'utf-8');

describe('DaySection — 移除 Hotel card 與 DayDrivingStatsCard (R19)', () => {
  it('不 import Hotel 元件', () => {
    // Match: import Hotel from './Hotel';  或  import Hotel from "./Hotel";
    const match = src.match(/import\s+Hotel\s+from\s+['"]\.\/Hotel['"]/);
    expect(match).toBeNull();
  });

  it('不 import DayDrivingStatsCard', () => {
    // Match: import { DayDrivingStatsCard } from './DrivingStats';
    const match = src.match(/import\s*\{[^}]*DayDrivingStatsCard[^}]*\}\s*from\s+['"]\.\/DrivingStats['"]/);
    expect(match).toBeNull();
  });

  it('不 import calcDrivingStats', () => {
    const match = src.match(/import\s*\{[^}]*calcDrivingStats[^}]*\}\s*from\s+['"][^'"]*drivingStats['"]/);
    expect(match).toBeNull();
  });

  it('不 import toHotelData', () => {
    // toHotelData 只供 Hotel.tsx 使用；Hotel 移除後 toHotelData 也不該出現在 DaySection
    const match = src.match(/\btoHotelData\b/);
    expect(match).toBeNull();
  });

  it('不在 JSX 中渲染 <Hotel>', () => {
    // Match: <Hotel 後接空白 / 閉 tag / self-close（不會誤配 <HotelChip> 等其他元件）
    const match = src.match(/<Hotel(?=[\s/>])/);
    expect(match).toBeNull();
  });

  it('不在 JSX 中渲染 <DayDrivingStatsCard>', () => {
    const match = src.match(/<DayDrivingStatsCard(?=[\s/>])/);
    expect(match).toBeNull();
  });

  it('不宣告 dayDrivingStats useMemo', () => {
    const match = src.match(/\bdayDrivingStats\b/);
    expect(match).toBeNull();
  });
});
