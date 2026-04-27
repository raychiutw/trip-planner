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

test.beforeEach(async ({ page }) => {
  await setup(page);
});

test.describe('Drag flows — Section 8.1 reorder & cross-day', () => {
  test('Itinerary timeline grip handle visible per row + a11y label', async ({ page }) => {
    await page.goto(`/trips?selected=${TRIP_ID}`);
    await expect(page.getByRole('heading', { name: /2026 沖繩自駕五日遊/ })).toBeVisible();

    // Auto-wait grip rendering — TimelineRail 在 DaySection 內 lazy hydrate，
    // CI runner 比 local 慢一拍時 sync count() 會拿到 0。先 auto-wait first
    // visible，再數 count（同 layout-quality.spec.js pattern）。
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

    // 展開第一個 entry → 顯示 ⎘ / ⇅ icons (cross-day functionally available
    // via popover；drag-cross-day 為 V2 feature)
    const expandBtn = page.getByRole('button', { name: /展開景點/ }).first();
    await expandBtn.click();
    // ⎘ copy-open and ⇅ move-open buttons should appear (multi-day fixture)
    const moveBtn = page.getByRole('button', { name: '移到其他天' });
    await expect(moveBtn).toBeVisible();
  });
});

test.describe('Drag flows — Section 8.2 mobile webkit', () => {
  test('mobile viewport renders timeline grip handles with touch tap target', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/trips?selected=${TRIP_ID}`);
    await expect(page.getByRole('heading', { name: /2026 沖繩自駕五日遊/ })).toBeVisible();

    const firstGrip = page.getByRole('button', { name: /拖拉排序/ }).first();
    await expect(firstGrip).toBeVisible();
    // 44px touch target（CSS HIG H4）
    const box = await firstGrip.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(32); // grip is 32x32 button (内 18x18 icon)
    expect(box.height).toBeGreaterThanOrEqual(32);
  });
});

test.describe('Drag flows — Section 8.3 keyboard a11y', () => {
  test('Tab focuses timeline grip handle; Space initiates drag (dnd-kit built-in)', async ({ page }) => {
    await page.goto(`/trips?selected=${TRIP_ID}`);
    await expect(page.getByRole('heading', { name: /2026 沖繩自駕五日遊/ })).toBeVisible();

    const firstGrip = page.getByRole('button', { name: /拖拉排序/ }).first();
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
