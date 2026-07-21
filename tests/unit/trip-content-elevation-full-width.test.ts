/**
 * 行程內容欄 dark-mode elevation — 兩側仍深黑（owner 2026-07-21 第二輪回報，附截圖）。
 *
 * Context：v2.57.9（PR #1102）在 `.trip-content` 補了 `background: var(--color-secondary)`，
 * 但 `.trip-content` 只是 `.tp-page`（padding 40px + max-width 1440px 置中）內的一個
 * 子框，DayNav / offline banner 等其他兄弟元素、以及 `.tp-page` 自己的左右 padding 區，
 * 全都還是透出 `.app-shell-main` 底下 `.app-shell` 的 base 深色。截圖裡看到的「中間淺一階、
 * 兩側還是深黑」就是這個窄框造成的。
 *
 * 對照組：`/trips`（TripsListPage）用 `.tp-trips-shell` 在最外層（跟 `.tp-shell` 同級）
 * 整片上色，同一份設計沒有這個 band 問題 —— 這裡照抄同一個 pattern，而不是發明新規則：
 * 把 elevation 移到 TripPage 的最外層（`.tp-shell` 疊加一個頁面專屬 class），
 * 讓整欄（不只 .trip-content 那個窄框）都是 --color-secondary，並移除 .trip-content
 * 自己重複的 background（外層已經上色，內層再上同色是 no-op）。
 *
 * 三層 elevation（Apple HIG）：
 *   .app-shell         #1C1C1E（base）
 *   內容欄整片          --color-secondary（#2C2C2E，本次移到 outer wrapper）
 *   展開卡片明細         --color-tertiary（#3A3A3C，本次從 secondary 調高一階，
 *                        避免跟外層同色、层次消失 —— coordinator 明確提醒的風險）
 *   第三欄 panel         --color-tertiary（已完成，v2.57.10）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TRIP_PAGE = readFileSync(join(__dirname, '../../src/pages/TripPage.tsx'), 'utf8');
const TIMELINE_RAIL = readFileSync(join(__dirname, '../../src/components/trip/TimelineRail.tsx'), 'utf8');

describe('TripPage — 內容欄 elevation 移到最外層（不只 .trip-content 窄框）', () => {
  it('outer wrapper 有頁面專屬 class 疊在 .tp-shell 上', () => {
    expect(TRIP_PAGE).toMatch(/className="tp-shell tp-trip-page-shell"/);
  });

  it('.tp-shell.tp-trip-page-shell 整片套 --color-secondary（覆蓋全域 .tp-shell 的 base）', () => {
    expect(TRIP_PAGE).toMatch(/\.tp-shell\.tp-trip-page-shell\s*\{[^}]*background: var\(--color-secondary\);?[^}]*\}/);
  });

  it('.trip-content 不再重複宣告 background（外層已整片上色，內層重複宣告是 no-op 且會誤導下一個人)', () => {
    const tripContentRule = TRIP_PAGE.match(/\.trip-content\s*\{[^}]*\}/)?.[0] ?? '';
    expect(tripContentRule).not.toMatch(/background:\s*var\(--color-secondary\)/);
  });
});

describe('TimelineRail — 展開明細跟外層同色時的 elevation 修正', () => {
  it('.tp-rail-detail fallback 從 --color-secondary 調高到 --color-tertiary（外層已是 secondary，展開卡要再高一階才看得出層次）', () => {
    expect(TIMELINE_RAIL).toMatch(/\.tp-rail-detail\s*\{[\s\S]*?background: var\(--tone-subtle, var\(--color-tertiary\)\);/);
    expect(TIMELINE_RAIL).not.toMatch(/\.tp-rail-detail\s*\{[\s\S]*?background: var\(--tone-subtle, var\(--color-secondary\)\);/);
  });
});
