import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

async function enlargeText(page) {
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll('body *')].filter(el => el instanceof HTMLElement).map(el => [el, parseFloat(getComputedStyle(el).fontSize)]);
    for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`;
  });
}
async function verifyControl(button, minHeight) {
  await button.scrollIntoViewIfNeeded(); await button.focus(); await expect(button).toBeFocused();
  expect(await button.evaluate(el => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let textFits = true; let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      textFits &&= [...range.getClientRects()].every(r => r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1);
    }
    return { textFits, reachable: hit === el || el.contains(hit) };
  })).toMatchObject({ textFits: true, reachable: true });
  const box = await button.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(minHeight); expect(box.width).toBeGreaterThanOrEqual(24);
  expect(await button.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
}
async function contrast(page, selector) {
  const result = await page.evaluate(async selector => {
    const report = await window.axe.run({ include: [selector] }, { runOnly: ['color-contrast'] });
    return { violations: report.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), incomplete: report.incomplete.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })) };
  }, selector);
  expect(result).toEqual({ violations: [], incomplete: [] });
}

for (const width of [320, 375, 768, 1024, 1440]) test(`shared filters and day navigation at ${width}px with doubled text`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await setupApiMocks(page);
  await page.goto('/trips');
  const filters = page.getByRole('group', { name: '行程分類' }); await expect(filters).toBeVisible();
  await enlargeText(page); await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  for (const mode of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
    for (const button of await filters.getByRole('button').all()) {
      await verifyControl(button, 44); await button.press('Enter'); await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(filters.locator('[aria-pressed="true"]')).toHaveCount(1);
      await contrast(page, '.tp-trips-tab.is-active');
    }
    await contrast(page, width < 1024 ? '.tp-global-bottom-nav' : '.tp-sidebar-nav');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/trip/okinawa-trip-2026-Ray/map?day=all');
  const days = page.getByRole('navigation', { name: '行程日期' }); await expect(days).toBeVisible();
  await enlargeText(page); await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  await expect(days.getByRole('tab')).toHaveCount(0);
  for (const mode of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
    await page.getByTestId('map-day-overview').click();
    await expect(page.getByTestId('map-day-overview')).toHaveAttribute('aria-current', 'true');
    await page.getByTestId('map-day-overview').press('ArrowRight');
    const day1 = page.getByTestId('map-day-1'); await expect(day1).toBeFocused(); await expect(day1).toHaveAttribute('aria-current', 'true');
    await day1.press('ArrowRight');
    const day2 = page.getByTestId('map-day-2'); await expect(day2).toBeFocused(); await expect(day2).toHaveAttribute('aria-current', 'true');
    await verifyControl(day2, 34);
    await expect(page).toHaveURL(/\?day=2$/);
    await contrast(page, '.tp-map-day-tab.is-active');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('native safe-area insets keep root controls clear and reduced motion avoids animated day centering', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native emulation uses the Chromium DevTools protocol; reflow and keyboard behavior run on every browser.');
  await page.setViewportSize({ width: 375, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await setupApiMocks(page);
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 44, bottom: 34 } });
    await page.goto('/trips');
    const nav = page.getByTestId('global-bottom-nav'); await expect(nav).toBeVisible();
    const box = await nav.boundingBox(); expect(box.y + box.height).toBeLessThanOrEqual(844 - 34);
    const account = await page.getByTestId('titlebar-account').boundingBox(); expect(account.y).toBeGreaterThanOrEqual(44);
    await page.goto('/trip/okinawa-trip-2026-Ray/map?day=all');
    const overview = page.getByTestId('map-day-overview'); await expect(overview).toBeVisible();
    await page.evaluate(() => {
      window.dayScrollBehaviors = [];
      const native = Element.prototype.scrollTo;
      Element.prototype.scrollTo = function (...args) {
        if (this.matches('.tp-map-day-tabs')) window.dayScrollBehaviors.push(args[0]?.behavior);
        return native.apply(this, args);
      };
    });
    await overview.press('ArrowRight'); await expect(page.getByTestId('map-day-1')).toBeFocused();
    await page.getByTestId('map-day-1').press('ArrowRight'); await expect(page.getByTestId('map-day-2')).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.dayScrollBehaviors)).toEqual(['auto', 'auto']);
  } finally { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: {} }); await cdp.detach(); }
});

test('timeline day selection respects reduced motion and retains router state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await setupApiMocks(page);
  await page.goto('/trips?selected=okinawa-trip-2026-Ray#day1');
  const day2 = page.getByTestId('dn-day-2'); await expect(day2).toBeVisible();
  const historyState = await page.evaluate(() => {
    window.dayAnchorScrolls = [];
    const native = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      if (/^day\d+$/.test(this.id)) window.dayAnchorScrolls.push({ id: this.id, behavior: args[0]?.behavior });
      return native.apply(this, args);
    };
    return history.state;
  });
  await day2.press('Enter'); await expect(day2).toHaveAttribute('aria-current', 'true');
  await expect(page).toHaveURL('/trips?selected=okinawa-trip-2026-Ray#day2');
  expect(await page.evaluate(() => window.dayAnchorScrolls.at(-1))).toEqual({ id: 'day2', behavior: 'auto' });
  expect(await page.evaluate(() => history.state)).toEqual(historyState);
});
