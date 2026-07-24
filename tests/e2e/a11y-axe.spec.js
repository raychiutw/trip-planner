// @ts-check
/**
 * W15 · Accessibility 守衛 — axe-core 自動掃描 key 頁面。
 *
 * HIG a11y 收網（依賴 W1 4-tab/帳號 sheet、W4 色彩對比、W11 表單）。用 axe-core 對主要
 * 頁面跑無障礙稽核，鎖住 serious/critical 違規不得出現（防未來 regress）。
 *
 * 掃描範圍：mockable 的 key 頁（行程一覽 / 收藏 / 帳號 + 帳號 sheet）。地圖（Google Maps
 * referer/第三方 canvas）與聊天（後端串流）在 e2e 環境不穩，另計；此守衛先鎖住結構穩定、
 * a11y 最該顧的清單/表單/導覽面。
 *
 * axe 注入：page.addScriptTag(require.resolve('axe-core')) → window.axe.run(document)。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');
const axePath = require.resolve('axe-core');

const PAGES = [
  { name: 'trips', path: '/trips' },
  { name: 'favorites', path: '/favorites' },
  { name: 'account', path: '/account' },
];

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

/** 跑 axe，回 serious/critical 違規（精簡欄位）。 */
async function scanSeriousCritical(page) {
  await page.addScriptTag({ path: axePath });
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await window.axe.run(document, {
      resultTypes: ['violations'],
      // 排除第三方 widget 容器（地圖 canvas 等）—— 非我方 markup。
      exclude: [['.gm-style'], ['iframe']],
    });
  });
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      detail: v.nodes.slice(0, 4).map((n) => ({
        target: n.target.join(' '),
        data: (n.any && n.any[0] && n.any[0].data) || null,
      })),
    }));
}

for (const p of PAGES) {
  test(`a11y: ${p.name} 無 serious/critical axe 違規`, async ({ page }) => {
    await page.goto(p.path);
    await page.waitForLoadState('networkidle');
    const bad = await scanSeriousCritical(page);
    if (bad.length) {
      // eslint-disable-next-line no-console
      console.log(`\n[a11y ${p.name}] serious/critical:\n` + JSON.stringify(bad, null, 2));
    }
    expect(bad, `${p.name} 有 serious/critical a11y 違規`).toEqual([]);
  });
}

test('a11y: 帳號 sheet（帳號圓圈開啟）無 serious/critical axe 違規', async ({ page }) => {
  await page.goto('/trips');
  await page.waitForLoadState('networkidle');
  // 桌機側欄帳號 chip 或 手機 header 圓圈 → 開帳號 sheet。用 testid 容錯。
  const trigger = page.getByTestId('account-circle').or(page.getByTestId('sidebar-account-card')).first();
  if (await trigger.count()) {
    await trigger.click();
    await page.waitForTimeout(300);
  }
  const bad = await scanSeriousCritical(page);
  if (bad.length) {
    // eslint-disable-next-line no-console
    console.log('\n[a11y account-sheet] serious/critical:\n' + JSON.stringify(bad, null, 2));
  }
  expect(bad, '帳號 sheet 有 serious/critical a11y 違規').toEqual([]);
});
