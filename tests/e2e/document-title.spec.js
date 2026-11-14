/**
 * #1696 每頁的瀏覽器分頁標題：「頁名 · 行程名 — Tripline」，路由改變時更新。
 * 行程名取自 /api/my-trips 的 title（沒有則 name）。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

const A = MOCK_TRIPS_LIST[0];
const B = MOCK_TRIPS_LIST[1];

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
});

const cases = [
  ['/trips', '行程 — Tripline'],
  ['/favorites', '收藏 — Tripline'],
  ['/explore', '探索 — Tripline'],
  ['/account', '帳號 — Tripline'],
  [`/trip/${A.tripId}`, `行程 · ${A.title} — Tripline`],
  [`/trip/${A.tripId}/map?day=all`, `地圖 · ${A.title} — Tripline`],
  [`/trip/${B.tripId}/notes`, `筆記 · ${B.title} — Tripline`],
];

for (const [path, title] of cases) {
  test(`分頁標題 ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  });
}

test('聊天標題帶 active trip 名，離開行程頁後標題跟著更新', async ({ page }) => {
  await page.goto(`/trip/${A.tripId}`);
  await expect(page).toHaveTitle(`行程 · ${A.title} — Tripline`);
  await page.goto('/trips');
  await expect(page).toHaveTitle('行程 — Tripline');
  await page.goto('/chat');
  await expect(page).toHaveTitle(new RegExp(`^聊天 · .+ — Tripline$`));
});
