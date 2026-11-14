// @ts-check
/** #1712：行程清單桌機常駐搜尋欄（工具列最左）；手機維持點了才展開。 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑'); });

test('桌機：搜尋欄常駐在工具列最左、無展開鈕、顯示快捷鍵提示', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setupApiMocks(page);
  await page.goto('/trips');
  const input = page.getByTestId('trips-list-search-input');
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute('placeholder', '搜尋行程名稱或地區');
  await expect(page.getByTestId('trips-list-search-toggle')).toHaveCount(0);
  await expect(page.getByTestId('trips-list-search-hint')).toHaveText('⌥⌘F');
  const x = (id) => page.getByTestId(id).evaluate((el) => el.getBoundingClientRect().left);
  const searchX = await x('trips-list-search-input');
  expect(searchX).toBeLessThan(await x('trips-list-tab-all'));
  expect(searchX).toBeLessThan(await x('trips-list-sort'));
  await input.fill('沖繩');
  await expect(page.getByTestId('trips-list-search-count')).toBeVisible();
  await expect(page.getByTestId('trips-list-search-hint')).toHaveCount(0);
});

test('桌機：焦點順序 = 視覺順序（WCAG 2.4.3）：Tab 先到搜尋欄再到分類 tab', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setupApiMocks(page);
  await page.goto('/trips');
  await expect(page.getByTestId('trips-list-toolbar')).toBeVisible();
  await page.getByTestId('trips-list-toolbar').evaluate((t) => {
    // 把起點設在工具列前一個位置，下一次 Tab 就是工具列第一個可聚焦元素
    const a = document.createElement('span'); a.tabIndex = -1; a.id = 'tab-anchor';
    t.parentElement.insertBefore(a, t); a.focus();
  });
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('trips-list-search-input')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('trips-list-tab-all')).toBeFocused();
});

test('桌機：⌥⌘F 聚焦常駐欄位', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setupApiMocks(page);
  await page.goto('/trips');
  await expect(page.getByTestId('trips-list-toolbar')).toBeVisible();
  await page.keyboard.press('Alt+Meta+f');
  await expect(page.getByTestId('trips-list-search-input')).toBeFocused();
});

test('手機：維持點開才展開', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await setupApiMocks(page);
  await page.goto('/trips');
  await expect(page.getByTestId('trips-list-search-input')).toHaveCount(0);
  await page.getByTestId('trips-list-search-toggle').click();
  await expect(page.getByTestId('trips-list-search-input')).toBeFocused();
});
