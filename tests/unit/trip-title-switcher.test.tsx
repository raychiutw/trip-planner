/**
 * TripTitleSwitcher — 標題即切換器（owner 2026-07-21）
 *
 * 「移除切換行程 icon，改為點下行程名稱後切換，行程名稱後面接一個 V 符號」。
 *
 * 原本是 TitleBar 右側一顆 `⇄ ▾` 按鈕，與標題分離 —— 使用者要先認出那顆圖示
 * 才知道能換行程。改成標題自己可點、後面掛 chevron，對齊 iOS 上「標題帶 ⌄
 * = 可切換」的慣例。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TripTitleSwitcher from '../../src/components/shell/TripTitleSwitcher';

const TRIPS = [
  { tripId: 'okinawa', name: '沖繩之旅', title: '沖繩之旅', countries: 'JP' },
  { tripId: 'seoul', name: '首爾美食行', title: '首爾美食行', countries: 'KR' },
];

function renderSwitcher(over = {}) {
  const onPick = vi.fn();
  render(
    <TripTitleSwitcher
      label="沖繩之旅" trips={TRIPS} activeTripId="okinawa"
      onPick={onPick} testIdPrefix="chat" {...over}
    />,
  );
  return { onPick };
}

describe('TripTitleSwitcher', () => {
  it('標題本身就是按鈕', () => {
    renderSwitcher();
    const btn = screen.getByTestId('chat-trip-title');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.textContent).toMatch(/沖繩之旅/);
  });

  it('標題後面有 chevron，且是 SVG 不是字元', () => {
    renderSwitcher();
    const chevron = screen.getByTestId('chat-trip-title').querySelector('svg');
    expect(chevron, '缺少 chevron').toBeTruthy();
    // 用字元「▾」的話字級與基線隨字體變動，跨平台對不齊。
    expect(screen.getByTestId('chat-trip-title').textContent).not.toMatch(/[▾▼⌄]/);
  });

  it('點標題展開清單，再點一次收合', () => {
    renderSwitcher();
    const btn = screen.getByTestId('chat-trip-title');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('選一個行程 → 回呼並收合', () => {
    const { onPick } = renderSwitcher();
    fireEvent.click(screen.getByTestId('chat-trip-title'));
    fireEvent.click(screen.getByTestId('chat-trip-pick-seoul'));
    expect(onPick).toHaveBeenCalledWith('seoul');
    expect(screen.queryByRole('menu'), '選完應收合').toBeNull();
  });

  it('Esc 關閉', () => {
    renderSwitcher();
    fireEvent.click(screen.getByTestId('chat-trip-title'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('只有一個行程 → 純文字，不給可點的假象', () => {
    renderSwitcher({ trips: [TRIPS[0]] });
    expect(screen.queryByTestId('chat-trip-title'), '沒得換就不該有按鈕').toBeNull();
    expect(screen.getByText('沖繩之旅')).toBeTruthy();
  });

  it('aria-haspopup / aria-expanded 正確反映狀態', () => {
    renderSwitcher();
    const btn = screen.getByTestId('chat-trip-title');
    expect(btn.getAttribute('aria-haspopup')).toBe('menu');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('W6：目前行程列 role=menuitemradio + aria-checked + checkmark（SR 讀得出已選取）', () => {
    renderSwitcher();
    fireEvent.click(screen.getByTestId('chat-trip-title'));
    const active = screen.getByTestId('chat-trip-pick-okinawa');
    const other = screen.getByTestId('chat-trip-pick-seoul');
    expect(active.getAttribute('role')).toBe('menuitemradio');
    expect(active.getAttribute('aria-checked')).toBe('true');
    expect(other.getAttribute('aria-checked')).toBe('false');
    expect(active.querySelector('.tp-titlebar-trip-row-check'), '目前列應有 checkmark').toBeTruthy();
    expect(other.querySelector('.tp-titlebar-trip-row-check'), '非目前列不應有 checkmark').toBeNull();
  });

  it('W6：短清單（≤8）不顯搜尋框', () => {
    renderSwitcher();
    fireEvent.click(screen.getByTestId('chat-trip-title'));
    expect(screen.queryByTestId('chat-trip-search')).toBeNull();
  });

  it('W6：長清單（>8）顯搜尋框且本地 filter', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      tripId: `t${i}`, title: i === 0 ? '沖繩' : `行程${i}`, name: `行程${i}`, countries: 'JP',
    }));
    render(<TripTitleSwitcher label="沖繩" trips={many} activeTripId="t0" onPick={vi.fn()} testIdPrefix="chat" />);
    fireEvent.click(screen.getByTestId('chat-trip-title'));
    fireEvent.change(screen.getByTestId('chat-trip-search'), { target: { value: '沖繩' } });
    expect(screen.getByTestId('chat-trip-pick-t0'), '符合的留下').toBeTruthy();
    expect(screen.queryByTestId('chat-trip-pick-t1'), '不符的濾掉').toBeNull();
  });

  it('bug 修：dropdown portal 到 body + fixed（逃離 titlebar overflow:hidden 裁切），非巢在 wrap 內', () => {
    // 原本 dropdown 是 absolute 掛 .tp-titlebar-trip-title-wrap 內，被 .tp-titlebar-title
    // 的 overflow:hidden（長標題 ellipsis 用）整個裁掉 → 點了打不開。改 portal 逃離。
    renderSwitcher();
    fireEvent.click(screen.getByTestId('chat-trip-title'));
    const menu = screen.getByRole('menu');
    expect(menu.closest('.tp-titlebar-trip-title-wrap'), 'portal 出去、不巢在 wrap 內').toBeNull();
    expect(menu.style.position, 'fixed 定位逃離 overflow').toBe('fixed');
  });
});

describe('舊的 icon 切換器已移除', () => {
  const read = (rel) => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    return readFileSync(join(__dirname, '../..', rel), 'utf8');
  };

  for (const page of ['src/pages/ChatPage.tsx', 'src/pages/MapPage.tsx']) {
    it(`${page} 不再有 swap-horiz 圖示按鈕`, () => {
      expect(read(page), 'owner 要求移除切換行程 icon').not.toMatch(/swap-horiz/);
    });
  }
});

describe('#1140 story 1–3：render switcher 的頁面都要把 active trip 寫回 context', () => {
  /*
   * MapPage 原本**完全沒有寫回** —— 它的 `pickTrip` 只 navigate。於是從行程內地圖的
   * switcher 換行程後，切到聊天／地圖 tab 又跳回舊的那條（v2.57.71 修）。
   * ChatPage / TripsListPage 都有寫回，只有它漏了。
   *
   * 這條守的是**整類**：新頁面掛上 switcher 時如果忘了寫回，這裡會紅。
   * 行為層（換頁後狀態還在）由 `tests/e2e/active-trip-continuity.spec.js` 驗 ——
   * jsdom 沒有真正的導覽，unit 驗不到「切 tab 後還在」。
   */
  const { readFileSync, readdirSync, statSync } = require('node:fs');
  const { join } = require('node:path');
  const root = join(__dirname, '../..');

  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx$/.test(p)) out.push(p);
    }
    return out;
  };

  // 剝註解 —— 本檔的說明與 TripStackLayout 的註解都提到 TripTitleSwitcher，不剝會誤判
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const renderers = walk(join(root, 'src'))
    .map((f) => ({ file: f.slice(root.length + 1), src: strip(readFileSync(f, 'utf8')) }))
    .filter((f) => !f.file.endsWith('TripTitleSwitcher.tsx'))
    .filter((f) => /<TripTitleSwitcher[\s/>]/.test(f.src));

  it('掃到的 renderer 數量合理（守衛沒有掃空）', () => {
    expect(renderers.length, '沒掃到任何 render switcher 的頁面，正則可能失效').toBeGreaterThan(2);
  });

  it('每個 renderer 都取用 useActiveTrip', () => {
    const offenders = renderers.filter((f) => !/useActiveTrip\s*\(/.test(f.src)).map((f) => f.file);
    expect(offenders, '掛了 trip switcher 就要把選到的行程寫回 ActiveTripContext，否則切 tab 會跳回舊的').toEqual([]);
  });
});
