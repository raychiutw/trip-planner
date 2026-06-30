/**
 * GlobalMapPage 空 trips 時拔右側 sheet — regression for v2.33.115.
 *
 * Bug context: 登入後若無任何 trip，/map 頁顯示左側「還沒有行程可以看」card +
 * 右側「左側建立第一個行程後，地圖會用真實導航路線把每個景點串起來」hint。
 * 兩邊訊息語意重複且右側佔半屏空白 → 視覺很怪。
 *
 * Fix: `sheet={hasNoTrips ? undefined : sheet}`，AppShell 收到 undefined 自動
 * 降 2-pane layout（per AppShell.tsx:188 `(sheet || sheetPortalId) ? 3PANE : 2PANE`）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '../../src/pages/GlobalMapPage.tsx'),
  'utf8',
);

describe('GlobalMapPage v2.33.115 empty-state hide right sheet (regression)', () => {
  it('AppShell sheet prop 用 hasNoTrips conditional 而非無條件 sheet', () => {
    // 防止 regression — 任何人改回 `sheet={sheet}` 都會炸這條 test
    expect(SRC).toMatch(/sheet=\{hasNoTrips \? undefined : sheet\}/);
    expect(SRC).not.toMatch(/sheet=\{sheet\}\s*$/m);
  });

  it('hasNoTrips 仍從 trips.length === 0 derive（fix 沒順手改 truthy guard）', () => {
    expect(SRC).toMatch(/const hasNoTrips = trips !== null && trips\.length === 0/);
  });

  it('map picker uses /my-trips metadata instead of filtering /trips?all=1', () => {
    expect(SRC).toMatch(/apiFetch<MyTripRow\[]>\('\/my-trips'\)/);
    expect(SRC).not.toContain("apiFetch<TripSummary[]>('/trips?all=1')");
    expect(SRC).toMatch(/setTrips\(myJson\)/);
    expect(SRC).toMatch(/t\.totalDays/);
  });
});
