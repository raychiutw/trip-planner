/**
 * v2.33.6 feat — TripPage 右上「⋯」EmbeddedActionMenu 加「編輯行程」入口。
 *
 * 既有 menu: 共編設定 / 列印 / 下載格式
 * 新增: 編輯行程（放在最前，呼應 trip card menu 順序）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/TripsListPage.tsx'),
  'utf8',
);

describe('TripsListPage EmbeddedActionMenu — v2.33.6 編輯行程 entry', () => {
  it('EmbeddedActionMenuProps 加 onEdit prop', () => {
    expect(SRC).toMatch(/interface EmbeddedActionMenuProps\s*\{[\s\S]{0,300}onEdit:\s*\(\)\s*=>\s*void/);
  });

  it('EmbeddedActionMenu 解構 onEdit', () => {
    expect(SRC).toMatch(/function EmbeddedActionMenu\(\{[^}]*onEdit[^}]*\}/);
  });

  it('「編輯行程」menu item 存在 + Icon edit + testid', () => {
    expect(SRC).toMatch(/編輯行程/);
    expect(SRC).toMatch(/<Icon name="edit"\s*\/>\s*<span>編輯行程<\/span>/);
    expect(SRC).toMatch(/data-testid=\{`trip-embedded-menu-edit-\$\{tripId\}`\}/);
  });

  it('呼叫 onEdit 透過 runAndClose', () => {
    expect(SRC).toMatch(/onClick=\{runAndClose\(onEdit\)\}/);
  });

  it('caller 傳 onEdit navigate 到 /trip/:id/edit', () => {
    expect(SRC).toMatch(
      /onEdit=\{\(\)\s*=>\s*navigate\(`\/trip\/\$\{encodeURIComponent\(effectiveSelectedId\)\}\/edit`\)\}/,
    );
  });
});
