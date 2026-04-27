import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

/**
 * OverflowMenu / appearance 結構驗證（取代已刪除的 QuickPanel 測試）。
 *
 * QuickPanel FAB 已於 2026-04-19 移除，功能搬到 topbar + OverflowMenu 下拉選單。
 * 這份測試驗證新結構的完整性。
 */

const overflowMenuTsx = readFileSync('src/components/trip/OverflowMenu.tsx', 'utf-8');
const tripPageTsx = readFileSync('src/pages/TripPage.tsx', 'utf-8');
const sheetContentTsx = readFileSync('src/components/trip/TripSheetContent.tsx', 'utf-8');

function parseOverflowItems(source) {
  const blockStart = source.indexOf('export const OVERFLOW_ITEMS');
  if (blockStart === -1) return [];
  const blockEnd = source.indexOf('];', blockStart);
  const block = source.slice(blockStart, blockEnd + 2);
  const items = [];
  // Flexible regex: matches key/icon/label/action in any field order, optional extra fields
  const re = /key:\s*'([^']+)'[^}]*?icon:\s*'([^']+)'[^}]*?label:\s*'([^']+)'[^}]*?action:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(block))) {
    const requiresOnlineMatch = block.slice(m.index, m.index + 300).match(/requiresOnline:\s*(true|false)/);
    items.push({ key: m[1], icon: m[2], label: m[3], action: m[4], requiresOnline: requiresOnlineMatch?.[1] === 'true' });
  }
  return items;
}

/* ===== OverflowMenu 結構 ===== */

describe('OverflowMenu items', () => {
  const items = parseOverflowItems(overflowMenuTsx);

  it('OVERFLOW_ITEMS 有 12 項（PR-O 加入 collab 共編設定）', () => {
    // R19: 交通統計 card 移除，timeline 首 entry 承載前日住宿 check-out 語意
    // PR-O: 加入 collab 共編設定（settings group），從 11 → 12
    expect(items).toHaveLength(12);
  });

  it('包含所有預期 keys（今日路線/AI建議/航班 + 出發/備案/共編/切換行程/外觀/4 匯出格式）', () => {
    const expected = [
      'today-route', 'suggestions', 'flights',
      'checklist', 'backup',
      'collab', 'trip-select', 'appearance',
      'download-pdf', 'download-md', 'download-json', 'download-csv',
    ];
    expect(items.map(i => i.key)).toEqual(expected);
  });

  it('每個 item 有 key/icon/label/action 四欄位', () => {
    for (const item of items) {
      expect(item.key, `${item.key} 缺 key`).toBeTruthy();
      expect(item.icon, `${item.key} 缺 icon`).toBeTruthy();
      expect(item.label, `${item.key} 缺 label`).toBeTruthy();
      expect(item.action, `${item.key} 缺 action`).toBeTruthy();
    }
  });

  it('action 僅限 sheet / download', () => {
    for (const item of items) {
      expect(['sheet', 'download']).toContain(item.action);
    }
  });

  it('trip-select 為 requiresOnline 寫入動作', () => {
    const tripSelect = items.find(i => i.key === 'trip-select');
    expect(tripSelect?.requiresOnline).toBe(true);
  });

  it('下載項目都以 download- 前綴', () => {
    const downloads = items.filter(i => i.action === 'download');
    expect(downloads).toHaveLength(4);
    for (const d of downloads) {
      expect(d.key).toMatch(/^download-/);
    }
  });
});

/* ===== Topbar 整合驗證 ===== */

describe('TripPage Ocean topbar', () => {
  it('引入 OverflowMenu（取代 QuickPanel）', () => {
    expect(tripPageTsx).toContain("import OverflowMenu from '../components/trip/OverflowMenu'");
    expect(tripPageTsx).not.toContain('QuickPanel');
  });

  it('topbar 直接暴露 緊急 / 列印（AI 編輯 link 移除 — 走 sidebar 「行程」 → /manage）', () => {
    expect(tripPageTsx).toContain("setActiveSheet('emergency')");
    expect(tripPageTsx).toContain('togglePrint');
    // AI 編輯 link removed per user direction; sidebar 行程 nav still routes to /manage
    expect(tripPageTsx).not.toContain('AI 編輯');
  });

  it('topbar 不含死連結（PR3 Item 9：ocean-nav-tabs shell 已移除）', () => {
    // PR3 Item 9: dead tab bar shell completely removed from topbar
    expect(tripPageTsx).not.toContain('ocean-nav-tabs');
    // Dead sheet links not in topbar
    expect(tripPageTsx).not.toContain("setActiveSheet('today-route')");
    expect(tripPageTsx).not.toContain("setActiveSheet('flights')");
    expect(tripPageTsx).not.toContain("setActiveSheet('suggestions')");
  });

  it('無 FAB / Edit FAB 殘留', () => {
    expect(tripPageTsx).not.toContain('edit-fab');
    expect(tripPageTsx).not.toContain('editFab');
  });
});

/* ===== Sheet 內容仍可由 TripSheetContent 提供 ===== */

describe('OverflowMenu → TripSheetContent 銜接', () => {
  it('TripSheetContent 仍處理 checklist / backup / trip-select / appearance（R19 移除 driving）', () => {
    expect(sheetContentTsx).toContain("case 'checklist':");
    expect(sheetContentTsx).toContain("case 'backup':");
    expect(sheetContentTsx).not.toContain("case 'driving':");
    expect(sheetContentTsx).toContain("case 'trip-select':");
    expect(sheetContentTsx).toContain("case 'appearance':");
  });

  it('TripSheetContent 匯入 COLOR_MODE_OPTIONS（外觀設定用）', () => {
    expect(sheetContentTsx).toContain('COLOR_MODE_OPTIONS');
    expect(sheetContentTsx).not.toContain('THEME_ACCENTS');
    expect(sheetContentTsx).not.toContain('COLOR_THEMES');
  });
});

/* ===== Ocean-only design system 驗證 ===== */

describe('Ocean-only design system（appearance.ts）', () => {
  const appearanceTs = readFileSync('src/lib/appearance.ts', 'utf-8');

  it('appearance.ts 不定義 COLOR_THEMES / THEME_ACCENTS', () => {
    expect(appearanceTs).not.toContain('COLOR_THEMES');
    expect(appearanceTs).not.toContain('THEME_ACCENTS');
  });

  it('appearance.ts 保留 COLOR_MODE_OPTIONS', () => {
    expect(appearanceTs).toContain('COLOR_MODE_OPTIONS');
    expect(appearanceTs).toContain("'light'");
    expect(appearanceTs).toContain("'auto'");
    expect(appearanceTs).toContain("'dark'");
  });
});
