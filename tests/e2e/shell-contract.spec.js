// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST, MOCK_USER } = require('./api-mocks');
const axePath = require.resolve('axe-core');

const tripId = MOCK_TRIPS_LIST[0].tripId;

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`root navigation stays reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/trips');
    await expect(page.getByTestId('trips-list-page')).toBeVisible();
    const compact = width < 1024;
    const tab = page.getByTestId(compact ? 'global-bottom-nav-trips' : 'sidebar-nav-trips');
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('app-shell-bottom-nav')).toBeVisible({ visible: compact });
    await tab.focus();
    await expect(tab).toBeFocused();
    const bounds = await tab.boundingBox();
    expect(bounds).toBeTruthy();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    if (compact) {
      const navBounds = await page.getByTestId('app-shell-bottom-nav').boundingBox();
      expect(navBounds).toBeTruthy();
      expect(navBounds.y + navBounds.height).toBeLessThanOrEqual(844 - 12 + 1);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('root and filter navigation remain reachable with 200% text at a 320px reflow width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/trips');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const root = page.getByTestId('global-bottom-nav-trips');
  const filters = page.getByRole('group', { name: '行程分類' });
  await expect(root).toBeVisible();
  await expect(filters).toBeVisible();
  await filters.getByTestId('trips-list-tab-collab').click();
  await expect(filters.getByTestId('trips-list-tab-collab')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  await root.focus();
  await expect(root).toBeFocused();
  const focus = await root.evaluate((el) => {
    const style = getComputedStyle(el);
    return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  });
  expect(focus).toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

for (const width of [320, 1440]) {
  test(`root tabs switch branches and preserve one active location at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/trips');
    const prefix = width < 1024 ? 'global-bottom-nav' : 'sidebar-nav';
    await page.getByTestId(`${prefix}-favorites`).click();
    await expect(page).toHaveURL(/\/favorites(?:[?#]|$)/);
    await expect(page.getByTestId(`${prefix}-favorites`)).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId(`${prefix}-trips`)).not.toHaveAttribute('aria-current', 'page');
  });
}

test('trip day navigation uses navigation buttons and moves focus by arrow key', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto(`/trips?selected=${tripId}#day1`);
  const dayNav = page.getByRole('navigation', { name: '行程日期' });
  const day1 = dayNav.getByTestId('dn-day-1');
  const day2 = dayNav.getByTestId('dn-day-2');
  await expect(day1).toBeVisible();
  await day1.focus();
  await page.keyboard.press('ArrowRight');
  await expect(day2).toBeFocused();
  await expect(day2).toHaveAttribute('aria-current', 'true');
  await expect(dayNav.getByRole('tab')).toHaveCount(0);
});

test('trip classification changes the list without changing the root branch', async ({ page }) => {
  const [ownedTrip, sharedTrip] = [
    { ...MOCK_TRIPS_LIST[0], owner: MOCK_USER.email },
    { ...MOCK_TRIPS_LIST[1], owner: 'collaborator@example.com', role: 'editor' },
  ];
  await page.route(/\/api\/my-trips$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([ownedTrip, sharedTrip]),
  }));
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto('/trips');
  const filters = page.getByRole('group', { name: '行程分類' });
  await expect(filters).toBeVisible();
  await expect(filters.getByRole('tab')).toHaveCount(0);
  const mine = page.getByTestId('trips-list-tab-mine');
  const collab = page.getByTestId('trips-list-tab-collab');
  const ownedCard = page.getByTestId(`trips-list-card-${ownedTrip.tripId}`);
  const sharedCard = page.getByTestId(`trips-list-card-${sharedTrip.tripId}`);
  await mine.click();
  await expect(mine).toHaveAttribute('aria-pressed', 'true');
  await expect(ownedCard).toBeVisible();
  await expect(sharedCard).toHaveCount(0);
  await collab.click();
  await expect(collab).toHaveAttribute('aria-pressed', 'true');
  await expect(mine).toHaveAttribute('aria-pressed', 'false');
  await expect(ownedCard).toHaveCount(0);
  await expect(sharedCard).toBeVisible();
  await expect(page.getByTestId('global-bottom-nav-trips')).toHaveAttribute('aria-current', 'page');
});

test('soft keyboard hides the root nav while keeping the focused search reachable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.addInitScript(() => {
    const vv = new EventTarget();
    vv.height = window.innerHeight;
    vv.offsetTop = 0;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    window.__testViewport = vv;
  });
  await page.goto('/trips');
  await page.getByTestId('trips-list-search-toggle').click();
  const search = page.getByTestId('trips-list-search-input');
  await search.fill('沖繩');
  await page.evaluate(() => {
    window.__testViewport.height = window.innerHeight - 300;
    window.__testViewport.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('html')).toHaveAttribute('data-kb-open', '1');
  await expect(search).toBeFocused();
  await expect.poll(() => page.getByTestId('app-shell-bottom-nav').evaluate((el) => el.getBoundingClientRect().top >= window.innerHeight)).toBe(true);
  await page.evaluate(() => {
    window.__testViewport.height = window.innerHeight;
    window.__testViewport.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('html')).not.toHaveAttribute('data-kb-open');
});

for (const colorScheme of ['light', 'dark']) {
  test(`root and filter controls retain contrast and tap targets in ${colorScheme} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.goto('/trips');
    await expect(page.locator('body')).toHaveClass(colorScheme === 'dark' ? /dark/ : /^(?!.*dark)/);
    const controls = [page.getByTestId('global-bottom-nav-trips'), page.getByTestId('trips-list-tab-collab')];
    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box).toBeTruthy();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run({ include: [['.app-shell-bottom-nav'], ['.tp-trips-tabs']] }, { resultTypes: ['violations'] });
      return result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })) }));
    });
    expect(violations).toEqual([]);
  });
}

test('reduced motion removes the root navigation transition', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/trips');
  const duration = await page.getByTestId('app-shell-bottom-nav').evaluate((el) => getComputedStyle(el).transitionDuration);
  const seconds = duration.endsWith('ms') ? parseFloat(duration) / 1000 : parseFloat(duration);
  expect(seconds).toBeLessThanOrEqual(0.001);
});
