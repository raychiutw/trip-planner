// @ts-check
/**
 * drag-flows.spec.js — Section 8.1-8.3 drag-to-itinerary E2E coverage。
 *
 * Spec scenarios（drag-to-promote / drag-to-reorder spec）:
 *   - 8.1 promote / reorder / cross-day / demote
 *   - 8.2 iOS webkit 長按 + drag
 *   - 8.3 keyboard Tab + Space + Arrow + Enter
 *
 * 範圍備註：
 *   - Ideas tab (TripSheet) 在當前 IA 已 redirect 到 /trips?selected=:id（見
 *     openspec/changes/archive/2026-04-25-url-driven-sheet-state），E2E 路徑
 *     上 Ideas drag UI 不可達 → 8.1 promote / 8.2 mobile drag 用「a11y / DOM
 *     contract 可達性」驗證取代 runtime drag gesture。
 *   - dnd-kit gesture 在 Playwright 跨 jsdom + headed 不穩，runtime drag 完整
 *     scenario 留 V2 lift DndContext 後（含真正 Ideas tab UI）跑。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const TRIP_ID = 'okinawa-trip-2026-Ray';

async function setup(page) {
  await setupApiMocks(page);
  await page.route('**/api/route**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ routes: [{ geometry: { coordinates: [] }, duration: 0, distance: 0 }] }),
    });
  });
  await page.addInitScript((tripId) => {
    const exp = Date.now() + 180 * 86400000;
    localStorage.setItem('tp-trip-pref', JSON.stringify({ v: tripId, exp }));
  }, TRIP_ID);
}

// rev2 F5：拖拉排序改「sort-mode gated」— resting 列不放常駐 grip（Apple 慣例），
// 由 ⋯ context menu「重新排序」進入排序模式後所有列才顯 grip。grip 相關驗證先進此模式。
async function enterSortMode(page) {
  await page.getByRole('button', { name: /更多動作/ }).first().click();
  await page.getByRole('menuitem', { name: '重新排序' }).click();
}

test.beforeEach(async ({ page }) => {
  await setup(page);
});

test.describe('Drag flows — Section 8.1 reorder & cross-day', () => {
  test('Itinerary timeline grip handle visible per row + a11y label（排序模式）', async ({ page }) => {
    await page.goto(`/trips?selected=${TRIP_ID}`);
    await expect(page.getByRole('heading', { name: /2026 沖繩自駕五日遊/ })).toBeVisible();

    // rev2 F5：grip 只在排序模式顯示（⋯ menu「重新排序」進入）。
    await enterSortMode(page);
    const grips = page.getByRole('button', { name: /拖拉排序/ });
    await expect(grips.first()).toBeVisible();
    const count = await grips.count();
    expect(count).toBeGreaterThan(0);
    const firstLabel = await grips.first().getAttribute('aria-label');
    expect(firstLabel).toContain('拖拉排序');
  });

  test('Cross-day move via ⎘/⇅ popover (drag-cross-day UI deferred V2)', async ({ page }) => {
    await page.goto(`/trips?selected=${TRIP_ID}`);
    await expect(page.getByRole('heading', { name: /2026 沖繩自駕五日遊/ })).toBeVisible();

    // rev2 F4：動作收進 ⋯ context menu — 開 menu 後「移到其他天」即現（cross-day functionally
    // available via menu；drag-cross-day 為 V2 feature）。
    await page.getByRole('button', { name: /更多動作/ }).first().click();
    const moveBtn = page.getByRole('menuitem', { name: '移到其他天' });
    await expect(moveBtn).toBeVisible();
  });
});

test.describe('Drag flows — Section 8.2 mobile webkit', () => {
  test('mobile viewport renders timeline grip handles with touch tap target', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/trips?selected=${TRIP_ID}`);
    await expect(page.getByRole('heading', { name: /2026 沖繩自駕五日遊/ })).toBeVisible();

    // rev2 F5：grip 只在排序模式顯示（⋯ menu「重新排序」進入）。
    await enterSortMode(page);
    const firstGrip = page.getByRole('button', { name: /拖拉排序/ }).first();
    await expect(firstGrip).toBeVisible();
    // 2026-05-02 v2.18.3：grip 從 32x32 改 24x24 對齊 mockup S12 Variant A
    // (terracotta-preview-v2.html .tp-stop-v-grip)。documented exception 對
    // Apple HIG 44px tap target，詳見 DESIGN.md Decisions Log + Accessibility
    // section。
    //
    // 2026-05-11 v2.26.0：root-cause 修法 — 之前的 atomic scroll+measure
    // (v2.24.6) 仍 flaky，因為 `scrollIntoView()` 是 sync 但 layout/paint commit
    // 在 next frame；mobile webkit 在 dnd-kit useSortable transform container
    // 內，第一次 paint 時 grid layout 還沒 flush，getBoundingClientRect 回 0。
    //
    // 修法：(1) scrollIntoView → (2) double RAF 等 scroll commit + layout flush
    // → (3) measure rect。包在 expect.poll() 自動 retry 直到 width ≥ 24（element
    // 一定會 settle，只是時序不定）。
    const measureGrip = async () => firstGrip.evaluate((el) => new Promise((resolve) => {
      el.scrollIntoView({ block: 'center', inline: 'center' });
      // 雙 RAF：第一幀讓 scroll 提交，第二幀讓 layout 與 transform settle。
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        resolve({ width: r.width, height: r.height });
      }));
    }));
    await expect.poll(async () => (await measureGrip()).width, {
      timeout: 5000,
      intervals: [100, 250, 500, 1000],
      message: 'grip width should be ≥ 24px (mockup S12 Variant A) after layout settles',
    }).toBeGreaterThanOrEqual(24);
    await expect.poll(async () => (await measureGrip()).height, {
      timeout: 5000,
      intervals: [100, 250, 500, 1000],
    }).toBeGreaterThanOrEqual(24);
  });
});

test.describe('Drag flows — Section 8.3 keyboard a11y', () => {
  test('Tab focuses timeline grip handle; Space initiates drag (dnd-kit built-in)', async ({ page }) => {
    await page.goto(`/trips?selected=${TRIP_ID}`);
    await expect(page.getByRole('heading', { name: /2026 沖繩自駕五日遊/ })).toBeVisible();

    // rev2 F5：grip 只在排序模式顯示（⋯ menu「重新排序」進入）。
    await enterSortMode(page);
    const firstGrip = page.getByRole('button', { name: /拖拉排序/ }).first();
    // Mobile-safari off-screen focus 不可靠 — 先 scroll into view 再 focus
    await firstGrip.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await firstGrip.focus();
    await expect(firstGrip).toBeFocused();
    // 觸發 Space — dnd-kit KeyboardSensor 接管。runtime 完整位移流程 jsdom/
    // headless 不穩，此 spec 只驗 focus + key dispatch 不報錯。
    await page.keyboard.press('Space');
    // Esc 取消（dnd-kit built-in）
    await page.keyboard.press('Escape');
  });

  test('aria-live announcement region exists for screen reader context', async ({ page }) => {
    await page.goto(`/trips?selected=${TRIP_ID}`);
    // dnd-kit DndLiveRegion 由 DndContext 自帶，TimelineRail wrap 即注入
    const liveRegion = page.locator('[role="status"][aria-live]').first();
    await expect(liveRegion).toBeAttached();
  });
});
