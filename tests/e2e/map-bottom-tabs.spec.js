// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.route('**/api/route**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
    });
  });
});

test.describe('MapPage bottom day tabs', () => {
  test('map viewport leaves a visible attribution area above cards and mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/trip/okinawa-trip-2026-Ray/map?day=all');
    await expect(page.locator('.tp-map-entry-card').first()).toBeVisible();
    await expect(page.locator('.tp-map-container')).toBeVisible();

    const measure = () => page.evaluate(() => {
      const map = document.querySelector('.tp-map-container').getBoundingClientRect();
      const cards = document.querySelector('.map-page-cards').getBoundingClientRect();
      const navElement = document.querySelector('.tp-global-bottom-nav');
      const nav = navElement?.getClientRects().length ? navElement.getBoundingClientRect() : null;
      const fabs = document.querySelector('.tp-map-fabs')?.getBoundingClientRect();
      // Approximate the native Google footer's bottom 25px; its exact markup is API-owned.
      const attributionTop = map.bottom - 25;
      return { mapBottom: map.bottom, cardsTop: cards.top, navTop: nav?.top, fabsBottom: fabs?.bottom, attributionTop };
    });

    for (const viewport of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      const positions = await measure();
      expect(positions.mapBottom).toBeLessThanOrEqual(positions.cardsTop - 8);
      if (positions.navTop !== undefined) expect(positions.mapBottom).toBeLessThan(positions.navTop);
      if (positions.fabsBottom !== undefined) expect(positions.fabsBottom).toBeLessThan(positions.attributionTop);
    }

    // A taller Google POI accessory must shrink the viewport instead of covering its footer.
    await page.setViewportSize({ width: 320, height: 568 });
    await page.locator('.map-page-cards').evaluate((cards) => { cards.style.height = '180px'; });
    const withTallCard = await measure();
    expect(withTallCard.mapBottom).toBeLessThanOrEqual(withTallCard.cardsTop - 8);
  });

  test('switching a bottom day tab updates URL and resets cards to day-local index', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/map?day=all');

    // PR #459 #6: nav 改 role=navigation (drop tablist)，button 用 plain
     // type=button + aria-current 取代 role=tab + aria-selected。
    const tabs = page.getByRole('navigation', { name: '行程日期' });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole('button', { name: /總覽/ })).toHaveAttribute('aria-current', 'true');

    await tabs.getByRole('button', { name: /DAY 2\b/ }).click();

    await expect(page).toHaveURL(/\/trip\/okinawa-trip-2026-Ray\/map\?day=2$/);
    await expect(tabs.getByRole('button', { name: /DAY 2\b/ })).toHaveAttribute('aria-current', 'true');

    const firstCard = page.locator('.tp-map-entry-card').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.locator('.tp-map-entry-card-num')).toHaveText('1');

    await firstCard.click();
    // #1168：選中狀態從 aria-pressed 改成 aria-current。本元件掛 role="listitem"（父容器是
    // role="list"），listitem 覆蓋了 <button> 的隱含 role，而 aria-pressed 只允許用在
    // button → axe 判 aria-allowed-attr critical。aria-current 是全域屬性、任何 role 合法。
    await expect(firstCard).toHaveAttribute('aria-current', 'true');
  });
});
