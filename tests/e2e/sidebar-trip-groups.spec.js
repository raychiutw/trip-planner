/**
 * #1709：桌機側欄「我的行程」依日期分組（進行中／即將出發｜過去可折疊）＋常駐過濾欄。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const t = (tripId, name, s, e, extra = {}) => ({ tripId, name, title: name, owner: 'Ray', role: 'owner', startDate: day(s), endDate: day(e), ...extra });
const TRIPS = [
  t('now', '進行中的行程', -1, 2),
  t('soon', '即將出發的行程', 10, 14),
  t('old1', '去年的京都', -400, -396),
  t('old2', '去年的大阪', -300, -296),
  t('arch', '已歸檔的行程', 5, 8, { archivedAt: '2026-01-01T00:00:00Z' }),
];

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  await page.route(/\/api\/my-trips$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TRIPS) }));
  await page.goto('/trips');
  await page.waitForLoadState('networkidle');
});

test('進行中與即將出發同組、過去預設折疊並顯示筆數、已歸檔不列入', async ({ page }) => {
  await expect(page.getByTestId('sidebar-trip-now')).toBeVisible();
  await expect(page.getByTestId('sidebar-trip-soon')).toBeVisible();
  await expect(page.getByTestId('sidebar-trip-old1')).toBeHidden();
  await expect(page.getByTestId('sidebar-trip-arch')).toHaveCount(0);
  const past = page.getByTestId('sidebar-trips-past-toggle');
  await expect(past).toContainText('過去');
  await expect(past).toContainText('2');
  await expect(past).toHaveAttribute('aria-expanded', 'false');
  await past.click();
  await expect(page.getByTestId('sidebar-trip-old1')).toBeVisible();
  await expect(page.getByTestId('sidebar-trip-old2')).toBeVisible();
});

test('過濾欄即時篩選、placeholder 寫明範圍，命中過去行程會自動展開', async ({ page }) => {
  const input = page.getByTestId('sidebar-trips-filter');
  await expect(input).toHaveAttribute('placeholder', '搜尋行程名稱');
  await input.fill('京都');
  await expect(page.getByTestId('sidebar-trip-old1')).toBeVisible();
  await expect(page.getByTestId('sidebar-trip-now')).toBeHidden();
  await input.fill('不存在');
  await expect(page.getByTestId('sidebar-trips-no-match')).toBeVisible();
});
