import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

/**
 * QuickPanel structural validations — TSX + CSS structure checks.
 */

const tsx = readFileSync('src/components/trip/QuickPanel.tsx', 'utf-8');
const styleCss = readFileSync('css/style.css', 'utf-8');

/* ===== Helpers ===== */

/** Extract all CSS rules containing a given selector substring */
function rulesFor(css, selector) {
  const rules = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (m[1].includes(selector)) {
      rules.push({ selector: m[1].trim(), body: m[2].trim() });
    }
  }
  return rules;
}

/** Get the body of the first rule matching a selector */
function ruleBody(css, selector) {
  const rules = rulesFor(css, selector);
  const exact = rules.find(r => r.selector === selector);
  return exact ? exact.body : (rules[0]?.body ?? '');
}

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
 * 解析 THEME_OPTIONS 陣列（從 TSX 原始碼抽取 key）
 */
function parseThemeKeys(source) {
  const blockStart = source.indexOf('const THEME_OPTIONS');
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
      'trip-select', 'appearance', 'printer',
      'download-pdf', 'download-md', 'download-json', 'download-csv',
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

  it('Section 分布正確：A=4, B=6, C=4', () => {
    const sectionA = items.filter(i => i.section === 'A');
    const sectionB = items.filter(i => i.section === 'B');
    const sectionC = items.filter(i => i.section === 'C');
    expect(sectionA).toHaveLength(4);
    expect(sectionB).toHaveLength(6);
    expect(sectionC).toHaveLength(4);
  });

  it('download action 的 key 都以 "download-" 開頭', () => {
    const downloadItems = items.filter(i => i.action === 'download');
    expect(downloadItems.length).toBeGreaterThan(0);
    for (const item of downloadItems) {
      expect(item.key).toMatch(/^download-/);
    }
  });
});

/* ===== THEME_OPTIONS 驗證 ===== */

describe('THEME_OPTIONS 驗證', () => {
  const themeKeys = parseThemeKeys(tsx);

  it('THEME_OPTIONS 有 night 主題', () => {
    expect(themeKeys).toContain('night');
  });

  it('THEME_OPTIONS 沒有 ocean 主題', () => {
    expect(themeKeys).not.toContain('ocean');
  });

  it('THEME_OPTIONS 包含所有預期主題（sun/sky/zen/forest/sakura/night）', () => {
    const expected = ['sun', 'sky', 'zen', 'forest', 'sakura', 'night'];
    for (const key of expected) {
      expect(themeKeys).toContain(key);
    }
  });
});

/* ===== Each item has exactly one label (no duplicate label bug) ===== */

describe('QuickPanel single label per item', () => {
  it('each quick-panel-item renders one Icon and one label span', () => {
    // In the JSX, each button should have exactly one <Icon> and one <span className="quick-panel-label">
    // The pattern for rendering items is: <Icon .../> then <span className="quick-panel-label">
    // Count occurrences of quick-panel-label in the item rendering sections
    const labelMatches = tsx.match(/className="quick-panel-label"/g);
    // There are 3 grid rendering sections (sectionA, sectionB, sectionC), each with one label per item
    // But labels appear in the map functions, so there should be exactly 3 occurrences
    // (one per map: sectionA+B map and sectionC map) - actually it's 3 map calls
    expect(labelMatches).not.toBeNull();
    // Each map renders one label per item — 3 separate map() calls
    expect(labelMatches.length).toBe(3);
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

  it('arrow rotates 180deg when open via CSS class', () => {
    const body = ruleBody(styleCss, '.quick-panel.open .quick-panel-arrow');
    expect(body).toContain('transform: rotate(180deg)');
  });
});

/* ===== Drill-down views ===== */

describe('QuickPanel drill-down', () => {
  it('supports grid, trip-select, appearance views', () => {
    expect(tsx).toContain("'grid'");
    expect(tsx).toContain("'trip-select'");
    expect(tsx).toContain("'appearance'");
  });

  it('has back button in drill-down views', () => {
    expect(tsx).toContain('quick-panel-back');
    expect(tsx).toContain('arrow-left');
  });

  it('trip-select view fetches /trips endpoint', () => {
    expect(tsx).toContain("apiFetch<TripListItem[]>('/trips')");
  });

  it('appearance view shows color mode and theme selectors', () => {
    expect(tsx).toContain('quick-panel-mode-group');
    expect(tsx).toContain('quick-panel-theme-group');
  });

  it('appearance view has all 6 theme options', () => {
    const themes = ['sun', 'sky', 'zen', 'forest', 'sakura', 'night'];
    for (const t of themes) {
      expect(tsx).toContain(`key: '${t}'`);
    }
  });

  it('appearance view has 3 color mode options', () => {
    expect(tsx).toContain("key: 'light'");
    expect(tsx).toContain("key: 'dark'");
    expect(tsx).toContain("key: 'auto'");
  });
});

/* ===== Body scroll lock ===== */

describe('QuickPanel scroll lock', () => {
  it('implements body scroll lock like InfoSheet', () => {
    expect(tsx).toContain('document.body.style.position');
    expect(tsx).toContain('savedBodyScrollY');
  });
});

/* ===== Escape key ===== */

describe('QuickPanel keyboard', () => {
  it('handles Escape key to close', () => {
    expect(tsx).toContain("e.key === 'Escape'");
    expect(tsx).toContain('triggerRef.current?.focus()');
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

  it('no .speed-dial CSS rules remain', () => {
    expect(styleCss).not.toContain('.speed-dial');
  });

  it('no .download-sheet CSS rules remain', () => {
    expect(styleCss).not.toContain('.download-sheet');
    expect(styleCss).not.toContain('.download-backdrop');
    expect(styleCss).not.toContain('.download-option');
  });
});
