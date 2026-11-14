// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const URL = '/trips?selected=okinawa-trip-2026-Ray';
const NAME = '調整中欄與右欄寬度';

async function widths(page) {
  return page.evaluate(() => ({
    main: document.querySelector('[data-testid="app-shell-main"]').getBoundingClientRect().width,
    sheet: document.querySelector('[data-testid="app-shell-sheet"]').getBoundingClientRect().width,
  }));
}

async function drag(page, toX) {
  const sep = page.getByRole('separator', { name: NAME });
  const box = await sep.boundingBox();
  const y = box.y + 200;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(toX, y, { steps: 5 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(URL);
  await expect(page.getByTestId('app-shell-sheet')).toBeVisible();
});

test('分隔線是可聚焦的 separator，有可及名稱，預設 1:1', async ({ page }) => {
  const sep = page.getByRole('separator', { name: NAME });
  await expect(sep).toBeVisible();
  await expect(sep).toHaveAttribute('tabindex', '0');
  await expect(sep).toHaveAttribute('aria-orientation', 'vertical');
  await expect(sep).toHaveAttribute('aria-valuenow', '50');
  const w = await widths(page);
  expect(Math.abs(w.main - w.sheet)).toBeLessThanOrEqual(1);
});

test('方向鍵 ±2%、雙擊回 1:1', async ({ page }) => {
  const sep = page.getByRole('separator', { name: NAME });
  await sep.focus();
  await page.keyboard.press('ArrowRight');
  await expect(sep).toHaveAttribute('aria-valuenow', '52');
  const w = await widths(page);
  expect(w.main).toBeGreaterThan(w.sheet);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(sep).toHaveAttribute('aria-valuenow', '48');
  await sep.dblclick();
  await expect(sep).toHaveAttribute('aria-valuenow', '50');
});

test('拖曳改變寬度，且守住最小寬 中欄 400／右欄 360', async ({ page, browserName }) => {
  // #1719：e2e 擋掉 Google Maps → 右欄出現可捲動的地圖錯誤遮罩（overflow-y:auto）。Linux 版 WebKit
  // 按住滑鼠拖過可捲動區塊時，即使有 pointer capture 也不再把滑鼠事件送進頁面（pointerup 都收不到）；
  // 拿掉遮罩或空白頁都正常，macOS WebKit 也正常。屬測試環境產物，拖曳邏輯由 chromium 覆蓋。
  test.skip(browserName === 'webkit', 'Linux WebKit 拖過可捲動的地圖錯誤遮罩時不送滑鼠事件（#1719）');
  const sep = page.getByRole('separator', { name: NAME });
  const box = await sep.boundingBox();
  await drag(page, box.x + 100);
  const w1 = await widths(page);
  expect(w1.main).toBeGreaterThan(w1.sheet + 150);
  await drag(page, 1275);
  const w2 = await widths(page);
  expect(Math.round(w2.sheet)).toBeGreaterThanOrEqual(360);
  expect(Math.round(w2.sheet)).toBeLessThanOrEqual(361);
  await drag(page, 250);
  const w3 = await widths(page);
  expect(Math.round(w3.main)).toBeGreaterThanOrEqual(400);
  expect(Math.round(w3.main)).toBeLessThanOrEqual(401);
});

test('手機寬度沒有分隔線', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('separator', { name: NAME })).toBeHidden();
});
