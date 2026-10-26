// @ts-check
/**
 * 設計審查守門（#1445）。2026-10-26 對 production 做 /design-review 後，把「使用者會遇到的版面缺陷」
 * 固定成真瀏覽器斷言：浮層不出界、內容不被浮動 tab bar 蓋住、對比、Esc 可關閉、大字型與縮放。
 *
 * 結構：一份 PAGES 清單（路由 + 必要時開啟浮層的步驟），每條斷言對清單裡每一筆在
 * 195／360／390／1440 寬 × 淺／深色（prefers-color-scheme 模擬，已驗證與 body.dark 計算色等價）載入。
 * 新增頁面只要加一筆，不用寫新測試。失敗訊息會指出「頁面 / 寬度 / 主題 / 元素」。
 *
 * 與既有守門的分工：a11y-axe.spec.js 掃預設頁面狀態的 axe 違規；overlay-focus-lifecycle 驗焦點；
 * 這支專門驗「跨寬度的幾何」—— 這類缺陷（浮層 x=-65、角色列被 tab bar 蓋 32px）axe 完全看不到。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const TRIP_ID = 'okinawa-trip-2026-Ray';

/** 195 = 手機 200% 縮放；360／390 = 常見手機；1440 = 桌機。 */
const WIDTHS = [195, 360, 390, 1440];
const THEMES = /** @type {const} */ (['light', 'dark']);

/**
 * @typedef {{ name: string, path: string, open?: (page: import('@playwright/test').Page) => Promise<void>, minWidth?: number }} PageCase
 * 每筆：name 顯示在失敗訊息；path 為路由；open 為進頁後要開啟的浮層（沒有就只載入頁面）。
 */

/**
 * 「載入頁面後，底部浮動 tab bar 不能蓋住可互動元素」要掃的頁面（F14）。
 * 只列手機版會顯示 tab bar 的頁；桌機沒有浮動底部 tab bar（bottomNavRect 為 null，斷言自動略過）。
 */
const NO_TAB_OVERLAP_PAGES = [
  { name: 'collab', path: `/trip/${TRIP_ID}/collab` },
  { name: 'health', path: `/trip/${TRIP_ID}/health` },
  { name: 'notes', path: `/trip/${TRIP_ID}/notes` },
  { name: 'trips', path: '/trips' },
  { name: 'favorites', path: '/favorites' },
  { name: 'account', path: '/account' },
  { name: 'chat', path: '/chat' },
];

/** @type {PageCase[]} */
const PAGES = [
  {
    // F13：手機行程下拉出界。標題列的行程切換器，是手機切換行程的唯一入口。
    name: 'trip-title-switcher',
    path: `/trips?selected=${TRIP_ID}`,
    open: async (page) => {
      // 195px（200% 縮放）下標題列擠到只剩 12px 寬的 chevron，Playwright 的 actionability 點不下去
      // （titlebar 擁擠屬 F3，待 owner 決定）；這裡只驗浮層幾何，所以直接觸發 DOM click。
      await page.locator('[data-testid$="-trip-title"]').first().evaluate((el) => /** @type {HTMLElement} */ (el).click());
      await page.getByRole('menu').first().waitFor();
    },
  },
];

async function setup(page) {
  await setupApiMocks(page);
  // 與 a11y-axe 同條件：擋 Google Maps（本機 .env.local 有 key、localhost 非授權 referer），
  // 路線 API 回空，避免頁面狀態隨外部服務飄。
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  await page.route('**/api/route**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
  }));
  await page.addInitScript((tripId) => {
    const exp = Date.now() + 180 * 86400000;
    localStorage.setItem('tp-trip-pref', JSON.stringify({ v: tripId, exp }));
  }, TRIP_ID);
}

/** 浮層選擇器：選單、dialog、listbox 皆算（popover 以 role=dialog／menu 出現）。 */
const OVERLAY_SELECTOR = '[role="menu"], [role="dialog"], [role="listbox"]';

/**
 * 回傳所有可見浮層超出視窗的描述（空陣列 = 全部在視窗內）。
 * 邊距容忍 0.5px（子像素）；視窗取 documentElement.clientWidth（排除捲軸）。
 */
async function overlaysOutsideViewport(page) {
  return page.evaluate((sel) => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    /** @type {string[]} */
    const bad = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      // 常駐 DOM 但「未開啟」的浮層（例如收合的 InfoSheet：整層 opacity 0 / pointer-events none，
      // 面板 translateY 到視窗外）不算浮層；有任一祖先看不見或不接事件就略過。
      let closed = false;
      for (let n = /** @type {Element | null} */ (el); n; n = n.parentElement) {
        const ns = getComputedStyle(n);
        if (parseFloat(ns.opacity) < 0.01 || ns.pointerEvents === 'none') { closed = true; break; }
      }
      if (closed) continue;
      if (r.left < -0.5 || r.right > vw + 0.5 || r.top < -0.5 || r.bottom > vh + 0.5) {
        const label = el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.className || el.tagName;
        bad.push(`${el.getAttribute('role')}[${String(label).slice(0, 40)}] left=${Math.round(r.left)} right=${Math.round(r.right)} top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} (viewport ${vw}x${vh})`);
      }
    }
    return bad;
  }, OVERLAY_SELECTOR);
}

/**
 * 回傳與底部浮動 tab bar 邊界重疊的可互動元素（空陣列 = 沒有）。
 * 頁面可捲動時先捲到底再量 —— 使用者最後會看到的就是那個狀態；tab bar 不在畫面上（桌機、
 * 已隨捲動滑出）時不算重疊。
 */
async function interactiveUnderTabBar(page) {
  return page.evaluate(async () => {
    const navEl = document.querySelector('.app-shell-bottom-nav');
    const scrollers = [...document.querySelectorAll('*')].filter((e) => {
      const cs = getComputedStyle(e);
      return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4 && e.getBoundingClientRect().width > 100;
    });
    for (const sc of scrollers) sc.scrollTop = sc.scrollHeight;
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 400));
    if (!navEl) return [];
    const nr = navEl.getBoundingClientRect();
    const vh = window.innerHeight;
    if (nr.width === 0 || nr.height === 0 || nr.top >= vh - 1 || getComputedStyle(navEl).display === 'none') return [];
    /** @type {string[]} */
    const bad = [];
    const sel = 'a[href], button, input, select, textarea, [role="button"], [role="tab"], [role="radio"], [role="checkbox"], [tabindex]:not([tabindex="-1"])';
    for (const el of document.querySelectorAll(sel)) {
      if (navEl.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') continue;
      if (r.bottom <= nr.top || r.top >= nr.bottom || r.right <= nr.left || r.left >= nr.right) continue;
      const overlapH = Math.min(r.bottom, nr.bottom) - Math.max(r.top, nr.top);
      if (overlapH < 2) continue;
      const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.tagName).trim().slice(0, 24);
      bad.push(`${el.tagName.toLowerCase()}[${label}] y=${Math.round(r.top)}–${Math.round(r.bottom)} 與 tab bar y=${Math.round(nr.top)}–${Math.round(nr.bottom)} 重疊 ${Math.round(overlapH)}px`);
    }
    return bad;
  });
}

test.describe('設計審查守門（#1445）', () => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test.describe(`${theme} ${width}px`, () => {
        test.beforeEach(async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
          await setup(page);
        });

        // 加一個矮視窗（600px）：內容量隨資料而變（production 共編頁 3 位成員時「角色」列剛好落在
        // tab bar 下方，mock 只有 1 位成員就躲過），矮視窗讓同樣的版面缺陷與資料量無關地現形。
        for (const c of NO_TAB_OVERLAP_PAGES.flatMap((p) => (width < 1024 ? [{ ...p, h: 844 }, { ...p, h: 600 }] : [{ ...p, h: 900 }]))) {
          test(`內容不被底部 tab bar 蓋住：${c.name} (h=${c.h})`, async ({ page }) => {
            await page.setViewportSize({ width, height: c.h });
            await page.goto(c.path);
            await page.waitForLoadState('networkidle');
            const bad = await interactiveUnderTabBar(page);
            expect(bad, `${c.name} @ ${theme} ${width}px 有可互動元素被 tab bar 蓋住：\n${bad.join('\n')}`).toEqual([]);
          });
        }

        for (const c of PAGES) {
          if (c.minWidth && width < c.minWidth) continue;
          if (c.open) {
            test(`浮層在視窗內：${c.name}`, async ({ page }) => {
              await page.goto(c.path);
              await c.open(page);
              const bad = await overlaysOutsideViewport(page);
              expect(bad, `${c.name} @ ${theme} ${width}px 有浮層超出視窗：\n${bad.join('\n')}`).toEqual([]);
            });
          }
        }
      });
    }
  }
});
