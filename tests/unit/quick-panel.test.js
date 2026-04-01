import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

/**
 * QuickPanel structural validations — TSX + CSS structure checks.
 */

const tsx = readFileSync('src/components/trip/QuickPanel.tsx', 'utf-8');

/* ===== PANEL_ITEMS 邏輯驗證（直接 import） ===== */

// 從 TSX 原始碼解析 PANEL_ITEMS 結構，供邏輯測試使用
// 使用靜態解析比 string match 更能驗證資料結構完整性

/**
 * 解析 PANEL_ITEMS 陣列（從 TSX 原始碼抽取 key/icon/label/action/section）
 * 格式：{ key: '...', icon: '...', label: '...', action: '...', section: '...' }
 */
function parsePanelItems(source) {
  // 擷取 PANEL_ITEMS 定義區塊（到第一個 ];）
  const blockStart = source.indexOf('const PANEL_ITEMS');
  const blockEnd = source.indexOf('];', blockStart);
  const block = source.slice(blockStart, blockEnd + 2);

  const items = [];
  // 每行一個 item：{ key: '...', icon: '...', label: '...', action: '...', section: '...' }
  const lineRe = /\{\s*key:\s*'([^']+)',\s*icon:\s*'([^']+)',\s*label:\s*'([^']+)',\s*action:\s*'([^']+)'(?:,\s*section:\s*'([^']+)')?\s*\}/g;
  let m;
  while ((m = lineRe.exec(block))) {
    items.push({ key: m[1], icon: m[2], label: m[3], action: m[4], section: m[5] ?? undefined });
  }
  return items;
}

/**
 * 解析 theme 陣列（從原始碼抽取 key）
 * @param {string} source - 原始碼
 * @param {string} [varName='COLOR_THEMES'] - 常數名稱
 */
function parseThemeKeys(source, varName = 'COLOR_THEMES') {
  const blockStart = source.indexOf(`const ${varName}`);
  if (blockStart === -1) return [];
  const blockEnd = source.indexOf('];', blockStart);
  const block = source.slice(blockStart, blockEnd + 2);
  const keys = [];
  const re = /key:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(block))) {
    keys.push(m[1]);
  }
  return keys;
}

/* ===== 14 panel items ===== */

describe('QuickPanel items', () => {
  it('defines exactly 14 panel items', () => {
    // Count items in the PANEL_ITEMS array by matching { key: '...' lines
    const matches = tsx.match(/\{ key: '[^']+', icon: '[^']+', label: '[^']+', action: '[^']+'/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(14);
  });

  it('includes all expected keys', () => {
    const expectedKeys = [
      'flights', 'checklist', 'emergency', 'backup',
      'suggestions', 'today-route', 'driving',
      'trip-select', 'appearance', 'printer',
      'download-pdf', 'download-md', 'download-json', 'download-csv',
    ];
    for (const key of expectedKeys) {
      expect(tsx).toContain(`key: '${key}'`);
    }
  });
});

/* ===== PANEL_ITEMS 結構完整性（邏輯測試） ===== */

describe('PANEL_ITEMS 結構完整性', () => {
  const items = parsePanelItems(tsx);

  it('PANEL_ITEMS 陣列有 14 項且順序正確', () => {
    expect(items).toHaveLength(14);
    const expectedOrder = [
      'flights', 'checklist', 'emergency', 'backup',
      'suggestions', 'today-route', 'driving',
      'trip-select', 'appearance',
      'printer', 'download-pdf', 'download-md', 'download-json', 'download-csv',
    ];
    expect(items.map(i => i.key)).toEqual(expectedOrder);
  });

  it('每個 item 都有 key/icon/label/action 四個必要欄位', () => {
    for (const item of items) {
      expect(item.key, `${item.key} 缺少 key`).toBeTruthy();
      expect(item.icon, `${item.key} 缺少 icon`).toBeTruthy();
      expect(item.label, `${item.key} 缺少 label`).toBeTruthy();
      expect(item.action, `${item.key} 缺少 action`).toBeTruthy();
    }
  });

  it('PANEL_ITEMS key 不重複', () => {
    const keys = items.map(i => i.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('Section 分布正確：A=4, B=5, C=5', () => {
    const sectionA = items.filter(i => i.section === 'A');
    const sectionB = items.filter(i => i.section === 'B');
    const sectionC = items.filter(i => i.section === 'C');
    expect(sectionA).toHaveLength(4);
    expect(sectionB).toHaveLength(5);
    expect(sectionC).toHaveLength(5);
  });

  it('download action 的 key 都以 "download-" 開頭', () => {
    const downloadItems = items.filter(i => i.action === 'download');
    expect(downloadItems.length).toBeGreaterThan(0);
    for (const item of downloadItems) {
      expect(item.key).toMatch(/^download-/);
    }
  });
});

/* ===== #9: 標題一致性 — trip-select 和 appearance label 與 InfoSheet title 一致 ===== */

describe('QuickPanel 標題一致性', () => {
  const items = parsePanelItems(tsx);

  it('trip-select label 為「切換行程」（與 InfoSheet title 一致）', () => {
    const tripSelect = items.find(i => i.key === 'trip-select');
    expect(tripSelect?.label).toBe('切換行程');
  });

  it('appearance label 為「外觀主題」（與 InfoSheet title 一致）', () => {
    const appearance = items.find(i => i.key === 'appearance');
    expect(appearance?.label).toBe('外觀主題');
  });
});

/* ===== COLOR_THEMES 驗證（DRY — now in src/lib/appearance.ts） ===== */

describe('COLOR_THEMES 驗證（appearance.ts）', () => {
  const appearanceTs = readFileSync('src/lib/appearance.ts', 'utf-8');
  const themeKeys = parseThemeKeys(appearanceTs);

  it('COLOR_THEMES 有 night 主題', () => {
    expect(themeKeys).toContain('night');
  });

  it('COLOR_THEMES 沒有 ocean 主題', () => {
    expect(themeKeys).not.toContain('ocean');
  });

  it('COLOR_THEMES 包含所有預期主題（sun/sky/zen/forest/sakura/night）', () => {
    const expected = ['sun', 'sky', 'zen', 'forest', 'sakura', 'night'];
    for (const key of expected) {
      expect(themeKeys).toContain(key);
    }
  });
});

/* ===== #1: DRY — TripPage imports from appearance.ts ===== */

describe('DRY: 常數不重複定義', () => {
  const tripPageTsx = readFileSync('src/pages/TripPage.tsx', 'utf-8');

  it('TripPage imports from appearance.ts', () => {
    expect(tripPageTsx).toContain("from '../lib/appearance'");
  });

  it('TripPage 不再本地定義 COLOR_THEMES', () => {
    // 不應有 const COLOR_THEMES 定義（但 import 是允許的）
    expect(tripPageTsx).not.toMatch(/const COLOR_THEMES/);
  });
});

/* ===== Each item has exactly one label (no duplicate label bug) ===== */

describe('QuickPanel single label per item', () => {
  it('each quick-panel-item renders one Icon and one label span', () => {
    // Each button has data-qp-item and a label <span> with Tailwind classes
    // Count occurrences of label spans in the item rendering sections
    const labelMatches = tsx.match(/leading-none">{item\.label}<\/span>/g);
    // There are 2 grid rendering sections (sectionA+B merged, sectionC), each with one label per item
    expect(labelMatches).not.toBeNull();
    // Each map renders one label per item — 2 separate map() calls
    expect(labelMatches.length).toBe(2);
  });

  it('does not have duplicate label spans in the same button (no speed-dial bug)', () => {
    // The old SpeedDial had TWO <span className="speed-dial-label"> per button
    // QuickPanel should not repeat the label
    const buttonBlocks = tsx.split('quick-panel-item');
    for (const block of buttonBlocks) {
      // Each block between 'quick-panel-item' markers should have at most 1 'quick-panel-label'
      const labels = (block.match(/quick-panel-label/g) || []);
      expect(labels.length).toBeLessThanOrEqual(1);
    }
  });
});

/* ===== FAB direction ===== */

describe('QuickPanel FAB trigger', () => {
  it('uses upward triangle SVG path', () => {
    expect(tsx).toContain('M12 8l-6 6h12z');
  });
});

/* ===== Sheet actions for trip-select and appearance ===== */

describe('QuickPanel sheet actions', () => {
  it('trip-select and appearance use sheet action (delegated to InfoSheet)', () => {
    const items = parsePanelItems(tsx);
    const tripSelect = items.find(i => i.key === 'trip-select');
    const appearance = items.find(i => i.key === 'appearance');
    expect(tripSelect?.action).toBe('sheet');
    expect(appearance?.action).toBe('sheet');
  });

  it('no drill-down action remains in PANEL_ITEMS', () => {
    const items = parsePanelItems(tsx);
    const drillDown = items.filter(i => i.action === 'drill-down');
    expect(drillDown).toHaveLength(0);
  });

  it('trip-select and appearance content is in TripPage', () => {
    const tripPageTsx = readFileSync('src/pages/TripPage.tsx', 'utf-8');
    expect(tripPageTsx).toContain("case 'trip-select':");
    expect(tripPageTsx).toContain("case 'appearance':");
  });

  it('TripPage imports appearance theme/color mode options from appearance.ts', () => {
    const tripPageTsx = readFileSync('src/pages/TripPage.tsx', 'utf-8');
    expect(tripPageTsx).toContain('COLOR_MODE_OPTIONS');
    expect(tripPageTsx).toContain('THEME_ACCENTS');
    expect(tripPageTsx).toContain('COLOR_THEMES');
  });
});

/* ===== Body scroll lock ===== */

describe('QuickPanel scroll lock', () => {
  it('implements body scroll lock via useSheetBehavior hook (which calls useBodyScrollLock)', () => {
    // scroll lock is delegated to useSheetBehavior
    expect(tsx).toContain('useSheetBehavior');
    expect(tsx).toContain('isOpen');
  });
});

/* ===== Escape key ===== */

describe('QuickPanel keyboard', () => {
  it('handles Escape key to close via useSheetBehavior', () => {
    // Escape handling is delegated to useSheetBehavior; triggerRef is passed so it gets focus on Escape
    const sheetBehaviorTs = readFileSync('src/hooks/useSheetBehavior.ts', 'utf-8');
    expect(sheetBehaviorTs).toContain("e.key === 'Escape'");
    expect(tsx).toContain('triggerRef');
  });
});

/* ===== #2: 無障礙 — focus trap + X close button ===== */

describe('QuickPanel 無障礙', () => {
  it('has focus trap using FOCUSABLE selector (same as InfoSheet) via useSheetBehavior', () => {
    // focus trap is delegated to useSheetBehavior
    const sheetBehaviorTs = readFileSync('src/hooks/useSheetBehavior.ts', 'utf-8');
    expect(sheetBehaviorTs).toContain('FOCUSABLE');
    expect(sheetBehaviorTs).toContain("e.key !== 'Tab'");
    expect(sheetBehaviorTs).toContain('first?.focus()');
    expect(sheetBehaviorTs).toContain('last?.focus()');
  });

  it('has X close button with aria-label', () => {
    // sheet-close-btn replaced by Tailwind inline classes
    expect(tsx).toContain('aria-label="關閉"');
    expect(tsx).toContain('closeBtnRef');
    expect(tsx).toContain('rounded-full');
  });

  it('focuses sheet on open (not close button, to avoid focus ring) via useSheetBehavior', () => {
    // focus management is delegated to useSheetBehavior
    const sheetBehaviorTs = readFileSync('src/hooks/useSheetBehavior.ts', 'utf-8');
    expect(sheetBehaviorTs).toContain('panelRef.current?.focus()');
  });
});

/* ===== #11: sheet-handle 移除 ===== */

describe('QuickPanel sheet-handle 移除', () => {
  it('does not render sheet-handle (no drag, use X button)', () => {
    expect(tsx).not.toContain('sheet-handle');
  });

  it('has header with close button instead', () => {
    // quick-panel-header replaced by Tailwind flex layout
    expect(tsx).toContain('flex items-center justify-end');
    expect(tsx).toContain('aria-label="關閉"');
  });
});

/* ===== #5: trips API 快取 ===== */

describe('TripPage trips 快取', () => {
  const tripPageTsx = readFileSync('src/pages/TripPage.tsx', 'utf-8');

  it('skips fetch when sheetTrips already has data', () => {
    expect(tripPageTsx).toContain('sheetTrips.length > 0');
  });
});

/* ===== CSS: no old remnants ===== */

describe('QuickPanel cleanup', () => {
  it('SpeedDial.tsx is deleted', () => {
    expect(() => readFileSync('src/components/trip/SpeedDial.tsx', 'utf-8')).toThrow();
  });

  it('DownloadSheet.tsx is deleted', () => {
    expect(() => readFileSync('src/components/trip/DownloadSheet.tsx', 'utf-8')).toThrow();
  });
});
