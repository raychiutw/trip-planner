/**
 * trip-page-focus-id.test.tsx — v2.33.48 round 7c regression guard
 *
 * v2.31.93 just shipped `?focus=<entryId>` URL param 從 /map 點 POI 跳行程
 * 的 deep-link flow。test-engineer round 7 audit 點出 page-level wiring 沒
 * regression test (marker-side test 有，但 TripPage 接這個 param 並 trigger
 * scrollIntoView 的路徑無 guard)。
 *
 * Pure source-grep — full integration 需 mock 整個 useTrip + Router state，
 * 屬於 e2e scope。本 spec 守住 wiring 不漂移。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/TripPage.tsx'),
  'utf-8',
);

describe('TripPage — ?focus= URL param wiring (v2.31.93)', () => {
  it('讀 ?focus= URL searchParam', () => {
    expect(SRC).toMatch(/searchParams\.get\(['"]focus['"]\)|URLSearchParams\([\s\S]*?\.get\(['"]focus['"]\)/);
  });

  it('用 data-scroll-anchor=entry-<id> selector 找節點', () => {
    expect(SRC).toMatch(/data-scroll-anchor="entry-/);
  });

  it('CSS.escape(focusParam) 防 selector injection', () => {
    expect(SRC).toMatch(/CSS\.escape\(focusParam\)/);
  });

  it('scrollIntoView block:nearest — ?focus fallback 已在視野就不捲（不移動頁面）', () => {
    // v2.55.44：center 會把已可見的 entry 硬拉到螢幕中央（= user 回報「跳到不相關位置」）；
    // nearest 只在離屏時最小捲入。正常返回走 scroll-memory 精準還原，這是 mem 空時的 fallback。
    expect(SRC).toMatch(/scrollIntoView\(\{\s*block:\s*['"]nearest['"]/);
  });

  it('focusParam 路徑 early return — 不再走 hash / autoScroll fallback', () => {
    // pattern: if (focusParam) { ... return; }（v2.55.x 加 focusDay→switchDay 後區塊變長）
    expect(SRC).toMatch(/if \(focusParam\)[\s\S]{0,900}return;/);
  });

  it('focusDay param → switchDay 切到該景點所在天（v2.55.x 回前頁還原展開）', () => {
    expect(SRC).toMatch(/get\(['"]focusDay['"]\)/);
    expect(SRC).toMatch(/dayNums\.includes\(focusDay\)[\s\S]{0,40}switchDay\(focusDay\)/);
  });

  it('包在 requestAnimationFrame — DOM 還沒 commit 不打 selector', () => {
    expect(SRC).toMatch(/requestAnimationFrame\(\(\) => \{[\s\S]{0,300}data-scroll-anchor/);
  });
});

describe('TripPage — `?sheet=collab` legacy redirect', () => {
  it('redirect to /trip/:id/collab via navigate({ replace: true })', () => {
    expect(SRC).toMatch(/sheetParam === ['"]collab['"]/);
    expect(SRC).toMatch(/\/collab[\s\S]{0,80}\{ replace: true \}/);
  });
});

describe('TripPage — v2.33.46 round 7a setTimeout cleanup (regression guard)', () => {
  it('autolocate effect 包 cancelAnimationFrame + clearTimeout cleanup', () => {
    expect(SRC).toMatch(/cancelAnimationFrame\(rafId\)/);
    expect(SRC).toMatch(/clearTimeout\(timeoutId\)/);
  });
});
