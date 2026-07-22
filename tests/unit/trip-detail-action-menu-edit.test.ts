/**
 * v2.33.6 feat — 行程頁右上「⋯」動作選單加「編輯行程」入口。
 *
 * 既有 menu: 共編設定 / AI 健檢 / 列印 / 下載格式
 * 新增: 編輯行程（放在最前，呼應 trip card menu 順序）
 *
 * v2.57.x：EmbeddedActionMenu 已從 TripsListPage.tsx 抽到共用元件
 * ../../src/components/trip/TripActionsMenu.tsx（供 TripStackLayout 共用），
 * 元件內部斷言改讀該檔；call-site（TripsListPage 的 onEdit wiring）仍讀 TripsListPage.tsx。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MENU_SRC = readFileSync(
  path.resolve(__dirname, '../../src/components/trip/TripActionsMenu.tsx'),
  'utf8',
);
const LIST_SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/TripsListPage.tsx'),
  'utf8',
);

describe('TripActionsMenu — v2.33.6 編輯行程 entry', () => {
  it('TripActionsMenuProps 加 onEdit prop', () => {
    expect(MENU_SRC).toMatch(/interface TripActionsMenuProps\s*\{[\s\S]{0,300}onEdit:\s*\(\)\s*=>\s*void/);
  });

  it('TripActionsMenu 解構 onEdit', () => {
    expect(MENU_SRC).toMatch(/function TripActionsMenu\(\{[^}]*onEdit[^}]*\}/);
  });

  it('「編輯行程」menu item 存在 + Icon edit + testid', () => {
    expect(MENU_SRC).toMatch(/編輯行程/);
    expect(MENU_SRC).toMatch(/<Icon name="edit"\s*\/>\s*<span>編輯行程<\/span>/);
    expect(MENU_SRC).toMatch(/data-testid=\{`trip-embedded-menu-edit-\$\{tripId\}`\}/);
  });

  it('呼叫 onEdit 透過 runAndClose', () => {
    expect(MENU_SRC).toMatch(/onClick=\{runAndClose\(onEdit\)\}/);
  });

  it('TripsListPage call site 傳 onEdit navigate 到 /trip/:id/edit', () => {
    expect(LIST_SRC).toMatch(
      /onEdit=\{\(\)\s*=>\s*navigate\(`\/trip\/\$\{encodeURIComponent\(effectiveSelectedId\)\}\/edit`\)\}/,
    );
  });
});
