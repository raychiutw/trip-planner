/**
 * v2.31.81：user batch UX fixes — 8 點。
 *
 * 1. MapPage handleCardClick 在 overview 模式同步 handleTabClick(targetDay)
 * 2. MapPage TitleBar title 改用 trip name（對齊 ChatPage 格式）+ picker icon-only
 * 3. 5 個 native <select> 加 site-style chevron + appearance:none
 * 4. TripSheet .trip-sheet-close 桌機 ≥1024px hide
 * 5. TimelineRail row click dispatch EVENT.entryFocused，TripMapRail listen → panTo
 * 6+7. DesktopSidebar 全 icon-only、移除「行程」、加入「探索」+「切換行程」
 * 8. Sidebar「聊天」 nav → /chat（AI chat 維持）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

describe('v2.31.81 #1: MapPage handleCardClick syncs day nav in overview mode', () => {
  const src = read('src/pages/MapPage.tsx');
  it('handleCardClick 內含 isOverview check + entryDayMap.get + handleTabClick call', () => {
    const m = src.match(/const handleCardClick = useCallback\(\(entryId: number\) => \{[\s\S]*?\}\,\s*\[isOverview,\s*entryDayMap,\s*handleTabClick\]\);/);
    expect(m, 'handleCardClick must depend on isOverview/entryDayMap/handleTabClick').toBeTruthy();
    const block = m![0];
    expect(block).toMatch(/isOverview/);
    expect(block).toMatch(/entryDayMap\.get\(entryId\)/);
    expect(block).toMatch(/handleTabClick\(targetDay\)/);
  });
});

describe('v2.31.81 #2: MapPage TitleBar matches ChatPage format', () => {
  const src = read('src/pages/MapPage.tsx');
  it('title 用 trip name（不再寫死「地圖」）', () => {
    expect(src).toMatch(/title=\{trip\?\.title \|\| trip\?\.name \|\| ['"]地圖['"]\}/);
  });
  it('trip picker button 不含 tp-titlebar-trip-picker-name span（icon-only）', () => {
    // 整檔不再含 tp-titlebar-trip-picker-name（v2.31.81 移除 trip name span）
    expect(src).not.toMatch(/tp-titlebar-trip-picker-name/);
    // picker 仍存在（swap-horiz icon + chevron）
    expect(src).toMatch(/swap-horiz/);
    expect(src).toMatch(/tp-titlebar-trip-picker/);
  });
});

describe('v2.31.81 #3: 5 native selects 拔 native UA chrome + 加 chevron', () => {
  const cases: Array<{ file: string; rule: string }> = [
    { file: 'css/tokens.css',                              rule: '\\.tp-select' },
    { file: 'src/pages/AddPoiFavoriteToTripPage.tsx',      rule: '\\.tp-favorites-add-to-trip \\.tp-form-select' },
    { file: 'src/pages/EntryActionPage.tsx',               rule: '\\.tp-entry-action-time-select' },
    { file: 'src/pages/TripsListPage.tsx',                 rule: '\\.tp-trips-sort' },
  ];
  for (const c of cases) {
    it(`${c.file} ${c.rule}：appearance:none + chevron data:image SVG`, () => {
      const content = read(c.file);
      // 找含 appearance: none 的 block 跟 chevron data:image SVG
      const re = new RegExp(`${c.rule}[^}]*appearance:\\s*none[^}]*background-image:\\s*url\\("data:image/svg`);
      expect(content).toMatch(re);
    });
  }

  it('EditTripPage 顯示語言 select 加 className="tp-select"', () => {
    const src = read('src/pages/EditTripPage.tsx');
    expect(src).toMatch(/id="edit-trip-lang"\s+className="tp-select"/);
  });
});

describe('v2.31.81 #4: TripSheet close X hidden on desktop ≥1024px', () => {
  const src = read('src/components/trip/TripSheet.tsx');
  it('media query (min-width: 1024px) 內 .trip-sheet-close display: none', () => {
    expect(src).toMatch(/@media\s*\(min-width:\s*1024px\)\s*\{\s*\.trip-sheet-close\s*\{\s*display:\s*none;?\s*\}/);
  });
});

describe('v2.31.81 #5: TimelineRail row click → entryFocused event → TripMapRail panTo', () => {
  it('events.ts 定義 entryFocused', () => {
    const src = read('src/lib/events.ts');
    expect(src).toMatch(/entryFocused:\s*['"]tp-entry-focused['"]/);
  });
  it('TimelineRail row click 內 dispatch EVENT.entryFocused', () => {
    const src = read('src/components/trip/TimelineRail.tsx');
    expect(src).toMatch(/dispatchEvent\(new CustomEvent\(EVENT\.entryFocused/);
  });
  it('TripMapRail 加 useEffect listen entryFocused → setPanToCoord(pin.lat, pin.lng)', () => {
    const src = read('src/components/trip/TripMapRail.tsx');
    expect(src).toMatch(/addEventListener\(EVENT\.entryFocused/);
    expect(src).toMatch(/setPanToCoord\(\{\s*lat:\s*pin\.lat,\s*lng:\s*pin\.lng\s*\}\)/);
  });
});

describe('v2.31.81 #6+#7: DesktopSidebar nav IA — icon-only + 探索 + 切換行程，no 行程', () => {
  const src = read('src/components/shell/DesktopSidebar.tsx');
  it('NavItemConfig key type 含 explore + switch-trip，不含 trips', () => {
    expect(src).toMatch(/'chat'\s*\|\s*'explore'\s*\|\s*'map'\s*\|\s*'favorites'\s*\|\s*'switch-trip'\s*\|\s*'login'/);
  });
  it('NAV_ITEMS array 含 6 items：chat / explore / map / favorites / switch-trip / login', () => {
    const m = src.match(/const NAV_ITEMS[\s\S]*?\];/);
    expect(m).toBeTruthy();
    const block = m![0];
    expect(block).toMatch(/key:\s*'chat'/);
    expect(block).toMatch(/key:\s*'explore'/);
    expect(block).toMatch(/key:\s*'map'/);
    expect(block).toMatch(/key:\s*'favorites'/);
    expect(block).toMatch(/key:\s*'switch-trip'/);
    expect(block).toMatch(/key:\s*'login'/);
    // 「行程」 nav 已移除（取代為「切換行程」走 /trips href）
    expect(block).not.toMatch(/key:\s*'trips'/);
  });
  it('JSX nav item 用 aria-label + title + sr-only span（icon-only）', () => {
    expect(src).toMatch(/aria-label=\{item\.label\}/);
    expect(src).toMatch(/title=\{item\.label\}/);
    expect(src).toMatch(/className="tp-nav-item-label"/);
  });
  it('SCOPED_STYLES 內 .tp-nav-item-label 是 sr-only (clip rect 0 0 0 0)', () => {
    expect(src).toMatch(/\.tp-nav-item-label\s*\{[^}]*clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);
  });
});

describe('v2.31.81 #8: sidebar 聊天 nav routes to /chat (AI chat)', () => {
  it('NAV_ITEMS 內 chat key href: /chat（已驗證 ChatPage 即 AI chat 功能）', () => {
    const src = read('src/components/shell/DesktopSidebar.tsx');
    expect(src).toMatch(/key:\s*'chat'[^}]*href:\s*['"]\/chat['"]/);
  });
});
