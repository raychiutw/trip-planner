import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { computeActiveDayIndex, getStableViewportH, computeInitialHash } from '../../src/lib/scrollSpy';

describe('computeActiveDayIndex', () => {
  it('Day 2 header 進入視窗頂部時標 Day 2（regression：舊 navH+10 閾值在 top=88 會誤回 Day 1）', () => {
    // 實測條件：navH=76, viewport=720, Day 2 header.top=88
    // 舊邏輯 threshold=86，88 > 86 → 0 (bug)
    // 新邏輯 threshold ≈ 291，88 < 291 → 1 ✓
    const tops = [-3048, 88, 3928, 7000, 10000];
    expect(computeActiveDayIndex(tops, 76, 720)).toBe(1);
  });

  it('頁面頂部（Day 1 header 剛在 nav 下方）時 active = Day 1', () => {
    const tops = [88, 2451, 4922, 7240, 9224];
    expect(computeActiveDayIndex(tops, 76, 720)).toBe(0);
  });

  it('捲到中段，Day N header 進入上 1/3 時切到 Day N', () => {
    // Day 3 top=222，threshold ≈ 291，222 < 291 → 2
    const tops = [-2049, -422, 222, 2540];
    expect(computeActiveDayIndex(tops, 76, 720)).toBe(2);
  });

  it('所有 header 都在 threshold 下方時回 -1（尚未捲到任何 day）', () => {
    const tops = [500, 1200, 2000];
    expect(computeActiveDayIndex(tops, 76, 720)).toBe(-1);
  });

  it('單天行程從頂部 active = 0', () => {
    expect(computeActiveDayIndex([88], 76, 720)).toBe(0);
  });

  it('空陣列回 -1', () => {
    expect(computeActiveDayIndex([], 76, 720)).toBe(-1);
  });

  it('null header（DOM 尚未渲染）跳過且不中斷迴圈', () => {
    const tops = [-3000, null, 100];
    expect(computeActiveDayIndex(tops, 76, 720)).toBe(2);
  });

  it('early break：遇到第一個 top > threshold 就停，不掃後續', () => {
    // Day 2 top=400 > threshold 291，Day 3 top=3000 更遠但不該被評估
    const tops = [-100, 400, 3000];
    expect(computeActiveDayIndex(tops, 76, 720)).toBe(0);
  });

  it('mobile URL bar 收縮時，位於 threshold 遠方的切換不受 innerHeight 微動影響', () => {
    // Day 2 top=100 遠低於 threshold；viewport 從 600 變 660（URL bar 收）結果不變
    expect(computeActiveDayIndex([-1000, 100], 56, 600)).toBe(1);
    expect(computeActiveDayIndex([-1000, 100], 56, 660)).toBe(1);
  });

  it('可視區極小時仍以 > threshold 作嚴格斷點（top 剛好等於 threshold 算納入）', () => {
    // vh=103, navH=100 → threshold = 100 + 3/3 = 101
    expect(computeActiveDayIndex([0, 101], 100, 103)).toBe(1);  // 101 > 101 為 false → 納入
    expect(computeActiveDayIndex([0, 102], 100, 103)).toBe(0);  // 102 > 101 為 true → break
  });
});

describe('getStableViewportH', () => {
  let originalInner: number;
  let originalClientH: number | undefined;

  beforeEach(() => {
    originalInner = window.innerHeight;
    originalClientH = document.documentElement.clientHeight;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: originalInner, configurable: true });
    if (originalClientH !== undefined) {
      Object.defineProperty(document.documentElement, 'clientHeight', {
        value: originalClientH,
        configurable: true,
      });
    }
  });

  it('優先回傳 documentElement.clientHeight（mobile 穩定）', () => {
    // 模擬 mobile：innerHeight 抖動（600→660）、clientHeight 穩定 720
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: 720,
      configurable: true,
    });
    expect(getStableViewportH()).toBe(720);

    Object.defineProperty(window, 'innerHeight', { value: 660, configurable: true });
    expect(getStableViewportH()).toBe(720); // clientHeight 穩定 → 結果穩定
  });

  it('clientHeight 為 0（exotic SSR / detached DOM）時 fallback 到 innerHeight', () => {
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: 0,
      configurable: true,
    });
    expect(getStableViewportH()).toBe(720);
  });
});

describe('computeInitialHash', () => {
  it('URL 已有 #dayN 且 N 存在於 dayNums → 回傳 null（不覆寫）', () => {
    expect(computeInitialHash([1, 2, 3], '#day2', null, [])).toBeNull();
  });

  it('URL 已有 #dayN 但 N 不存在 → 回傳 fallback（第一天）', () => {
    expect(computeInitialHash([1, 2, 3], '#day9', null, [])).toBe('#day1');
  });

  it('URL 無 hash、今日在行程中 → 回傳 #day{today}', () => {
    const today = '2026-07-30';
    const dates = ['2026-07-29', '2026-07-30', '2026-07-31'];
    expect(computeInitialHash([1, 2, 3], '', today, dates)).toBe('#day2');
  });

  it('URL 無 hash、今日不在行程中 → fallback 到第一天', () => {
    expect(computeInitialHash([1, 2, 3], '', '2030-01-01', ['2026-07-29'])).toBe('#day1');
  });

  it('單天行程無 hash 時回傳 #day1（fix 單天永不更新 hash bug）', () => {
    expect(computeInitialHash([1], '', null, [])).toBe('#day1');
  });

  it('空 dayNums（尚未載入）回傳 null', () => {
    expect(computeInitialHash([], '', null, [])).toBeNull();
  });
});
