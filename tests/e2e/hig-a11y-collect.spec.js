// @ts-check
/**
 * HIG／WCAG 收集（flutter#531 / trip-planner#1568）：不是守門，只印結果。
 *
 * 對 hig-scene-fixtures 的每個場景量四件事，輸出 `HIGA11Y\t<類別>\t<場景>\t<JSON>`：
 *  - axe：WCAG 2.0／2.1／2.2 A、AA 的違規（手機寬，淺色與深色各一次）。含色彩對比。
 *  - reflow：320×568 下有沒有橫向捲動（WCAG 1.4.10）。
 *  - zoom：文字放大 200%（html font-size 200%）後有沒有橫向捲動。只對 rem／em 排版有意義。
 *  - focus：連按 Tab 最多 14 次，記錄取得焦點但看不出焦點樣式的元素（WCAG 2.4.7）。
 *
 * 沒帶 HIG_COLLECT=1 時整批 skip，避免變成永遠綠燈的假測試。
 * 執行：HIG_COLLECT=1 npx playwright test tests/e2e/hig-a11y-collect.spec.js --project=chromium
 *
 * 限制：axe 在 mock 資料與外部地圖被擋的畫面上量；半透明背景、背景圖上的文字，axe 會標「needs review」
 * 而不是違規，這裡一併列出（incomplete），不算通過也不算失敗。
 */
import { test } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');
const { SCENES, setupSceneExtras, proveScene } = require('./hig-scene-fixtures');
const axePath = require.resolve('axe-core');

test.beforeEach(async ({}, testInfo) => {
  test.skip(!['chromium', 'webkit'].includes(testInfo.project.name), '只在 chromium 與 webkit 專案跑');
  test.skip(!process.env.HIG_COLLECT, '收集用；HIG_COLLECT=1 才執行');
});

const log = (kind, scene, data) => console.log(`HIGA11Y\t${kind}\t${scene}\t${JSON.stringify(data)}`);

async function open(page, scene, { width, height, scheme }) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height });
  await setupApiMocks(page);
  await setupSceneExtras(page);
  if (scene.loggedIn === false) {
    await page.route(/\/api\/oauth\/userinfo$/, (r) =>
      r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthorized"}' }));
  }
  if (scene.stub) await scene.stub(page);
  await page.goto(scene.path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  if (scene.act) await scene.act(page);
  if (scene.scope) await page.waitForTimeout(600); // 等彈出層進場動畫結束，axe 才不會量到半透明的過場
  // 量到錯的畫面比沒量更糟：有 proof 就先確認真的是想量的那一種狀態。
  await proveScene(page, scene);
}

// 只有桌機寬才有的表面（scene.viewports 不含 mobile）改在桌機寬量 axe，並略過 320px 重排。
const mobileOk = (scene) => !scene.viewports || scene.viewports.includes('mobile');
const axeSize = (scene) => (mobileOk(scene) ? { width: 390, height: 844 } : { width: 1280, height: 800 });

for (const scene of SCENES) {
  for (const scheme of /** @type {const} */ (['light', 'dark'])) {
    test(`axe ${scene.name} ${scheme}`, async ({ page }) => {
      await open(page, scene, { ...axeSize(scene), scheme });
      await page.addScriptTag({ path: axePath });
      const res = await page.evaluate(async () => {
        // @ts-ignore axe 由 addScriptTag 注入
        const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
        const slim = (v) => v.map((x) => ({
          id: x.id, impact: x.impact, count: x.nodes.length,
          sample: x.nodes.slice(0, 3).map((n) => ({
            target: n.target.join(' '),
            msg: (n.any[0] || n.all[0] || n.none[0] || {}).message || '',
          })),
        }));
        return { violations: slim(r.violations), incomplete: slim(r.incomplete) };
      });
      log(`axe-${scheme}`, scene.name, res);
    });
  }

  test(`reflow+zoom ${scene.name}`, async ({ page }) => {
    test.skip(!mobileOk(scene), '桌機寬才有的表面，沒有 320px 版');
    await open(page, scene, { width: 320, height: 568, scheme: 'light' });
    const over = () => page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
    }));
    const r1 = await over();
    log('reflow-320', scene.name, { ...r1, overflow: r1.scrollWidth > r1.innerWidth + 1 });
    const probe = () => page.evaluate(() => {
      const el = document.querySelector('main p, main h1, main h2, p, h1');
      return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
    });
    const f1 = await probe();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.waitForTimeout(300);
    const r2 = await over();
    const f2 = await probe();
    // fontScale 明顯小於 2 代表該頁字級不是 rem／em，這個 zoom 檢查對它沒有意義
    log('zoom-200', scene.name, { ...r2, overflow: r2.scrollWidth > r2.innerWidth + 1, fontScale: f1 ? +(f2 / f1).toFixed(2) : null });
  });

  test(`focus ${scene.name}`, async ({ page }) => {
    await open(page, scene, { width: 1280, height: 800, scheme: 'light' });
    const seen = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        const shadow = cs.boxShadow && cs.boxShadow !== 'none';
        const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('data-testid') || el.tagName)
          .trim().replace(/\s+/g, ' ').slice(0, 24);
        return { tag: el.tagName.toLowerCase(), label, visible: outline || !!shadow };
      });
      if (info) seen.push(info);
    }
    log('focus', scene.name, { tabbed: seen.length, noIndicator: seen.filter((s) => !s.visible).map((s) => `${s.tag}:${s.label}`) });
  });
}
