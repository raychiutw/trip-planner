/**
 * v2.31.81：user batch UX fixes — 8 點（v2.31.83 sidebar 部分 revert）。
 *
 * 1. MapPage handleCardClick 在 overview 模式同步 handleTabClick(targetDay) ✅
 * 2. MapPage TitleBar title 改用 trip name（對齊 ChatPage 格式）+ picker icon-only ✅
 * 3. 5 個 native <select> 加 site-style chevron + appearance:none ✅
 * 4. TripSheet .trip-sheet-close 桌機 ≥1024px hide ✅
 * 5. TimelineRail row click dispatch EVENT.entryFocused，TripMapRail listen → panTo ✅
 * 6+7. DesktopSidebar 全 icon-only、移除「行程」、加入「探索」+「切換行程」— v2.31.83 revert
 * 8. Sidebar「聊天」 nav → /chat（AI chat 維持）— v2.31.80 已是 /chat，sidebar revert 後仍 hold
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
    // 2026-07-21：標題改包在 TripTitleSwitcher 的 label 裡（owner 要求點名稱切換），
    // 但「用 trip name 而非寫死『地圖』」這條不變式仍然成立，只是位置換了。
    expect(src).toMatch(/label=\{trip\?\.title\s*\|\|\s*trip\?\.name/);
  });
  it('切換入口是標題本身，不是分離的圖示按鈕', () => {
    // 2026-07-21 形制變更（owner：「移除切換行程 icon，改為點下行程名稱後切換」）。
    // 本條原本鎖 v2.31.81 的 icon-only picker（swap-horiz + chevron，放在 TitleBar
    // 右側 actions）。那顆按鈕與標題分離，使用者要先認出圖示才知道能換行程。
    expect(src, 'owner 要求移除切換行程 icon').not.toMatch(/swap-horiz/);
    expect(src, '舊的分離式 picker 已由 TripTitleSwitcher 取代').not.toMatch(/tp-titlebar-trip-picker/);
    expect(src).toMatch(/<TripTitleSwitcher/);
  });
});

describe('v2.33.17 (was v2.31.81 #3): 5 native selects 全部遷移到 TripSelect', () => {
  // v2.31.81 #3 用 appearance:none + custom chevron 把 native select 美化成 pill；
  // v2.33.17 native popup 仍 OS chrome 不一致 → 整批換成 headlessui Listbox-based
  // TripSelect，這些頁面不再 import native <select>。
  const callsites = [
    'src/pages/AddPoiFavoriteToTripPage.tsx',
    'src/pages/EditTripPage.tsx',
    'src/pages/EntryActionPage.tsx',
    'src/pages/TripsListPage.tsx',
    'src/pages/AddEntryPage.tsx',
  ];
  for (const file of callsites) {
    it(`${file} import TripSelect`, () => {
      const content = read(file);
      expect(content).toContain("import { TripSelect } from '../components/TripSelect'");
    });
  }

  it('TripSelect component 存在', () => {
    expect(read('src/components/TripSelect.tsx')).toContain('export function TripSelect');
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

// v2.31.83 surgical revert：sidebar 復原到 v2.31.80（user：「sidebar 復原, 原本的修正都是調整 content 頁面 不要動 sidebar」）。
// v2.31.81 #6+#7（sidebar icon-only + 探索 + 切換行程）整個 revert，#8 sidebar chat→/chat 在 v2.31.80 已存在無需 lock。
// 詳細 sidebar IA assertions 由 tests/unit/desktop-sidebar.test.tsx 主管。
