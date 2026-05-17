// @vitest-environment node
/**
 * v2.31.55 fix: AddPoiFavoriteToTripPage tripDisplayName 對齊
 * title-first canonical（之前是 name-first outlier）。
 *
 * Bug (prod QA found)：user 在 trips list 看到 user-set 標題
 * 「2026 沖繩七日遊行程表」(trip.title)，但點「加入行程」打開
 * AddPoiFavoriteToTripPage 後 trip dropdown 顯示「Hui Yun 的沖繩之旅」
 * (trip.name backend auto-generated)。同一 trip 跨頁面 label 不一致 →
 * user 困惑「這是同一個 trip 嗎」。
 *
 * Root cause：tripDisplayName 寫成 `t.name || t.title || tripId`，
 * 但 trips list (TripsListPage:1088) / TripPickerPopover / ChatPage /
 * MapPage / GlobalMapPage 5 處都用 `t.title || t.name || tripId`。
 *
 * Fix：對齊 canonical pattern，title 優先 name 其次。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/AddPoiFavoriteToTripPage.tsx'),
  'utf8',
);

describe('v2.31.55 AddPoiFavoriteToTripPage tripDisplayName title-first', () => {
  it('tripDisplayName 改 title 優先 name 其次（對齊 5 處 canonical pattern）', () => {
    expect(SRC).toMatch(/function tripDisplayName[\s\S]{0,200}t\.title\?\.trim\(\) \|\| t\.name\?\.trim\(\) \|\| t\.tripId/);
  });

  it('原本 name-first 寫法已移除', () => {
    expect(SRC).not.toMatch(/t\.name\?\.trim\(\) \|\| t\.title\?\.trim\(\)/);
  });
});
