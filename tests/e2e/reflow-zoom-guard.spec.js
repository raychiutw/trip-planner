// @ts-check
/**
 * 320px 寬、html 字級 200% 下不得橫向捲動（WCAG 1.4.10 Reflow 的近似量法，#1571 W10）。
 * 長 email 這類不可斷字串原本會把 `.tp-verify-email`／`.tp-invite-body` 撐出容器。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');
const { SCENES, setupSceneExtras } = require('./hig-scene-fixtures');

for (const name of ['signup-check-email', 'invite']) {
  test(`320px + 字級 200%：${name} 不橫向捲動`, async ({ page }) => {
    const scene = SCENES.find((s) => s.name === name);
    await page.setViewportSize({ width: 320, height: 568 });
    await setupApiMocks(page);
    await setupSceneExtras(page);
    await page.route(/\/api\/oauth\/userinfo$/, (r) =>
      r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthorized"}' }));
    if (scene.stub) await scene.stub(page);
    await page.goto(scene.path);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(scene.proofText).first()).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.waitForTimeout(300);
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });
}
