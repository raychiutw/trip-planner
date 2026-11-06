// @ts-check
/**
 * HIG 取證場景（flutter#531 / trip-planner#1563）。
 *
 * 用既有的 api-mocks 把每個頁面開出來（不碰 prod、不需真實登入），在
 * 手機寬（390×844）與桌機寬（1280×800）、淺色與深色各截一張圖，並量測可點擊元素尺寸。
 *
 * 執行：
 *   HIG_SHOT_DIR=/path npx playwright test tests/e2e/hig-scenes.spec.js --project=chromium
 *   HIG_COLLECT=1 …   只印出各場景的違規（HIGWEB 行），不下斷言，用來更新 KNOWN_TAP_VIOLATIONS
 *
 * 量測只做「手機寬下可點擊元素最短邊 ≥ 44px」（檢查表 A1）；桌機寬不量（指標裝置不適用 44pt）。
 * 已知違規是棘輪：新增會紅，已知的被修好卻沒移除也會紅。
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const { setupApiMocks } = require('./api-mocks');
const { SCENES, setupSceneExtras, proveScene } = require('./hig-scene-fixtures');
const { KNOWN_TAP_VIOLATIONS, LABEL_MAX, diffViolations } = require('./hig-known-violations');

// 量測的尺寸與字型度量依瀏覽器引擎而異；已知違規清單只以 chromium 為準，其他 project 不跑，避免棘輪在 webkit 誤紅。
test.beforeEach(async ({}, testInfo) => {
  // 棘輪只以 chromium 為準；webkit 只在 HIG_COLLECT 模式下截圖（不下棘輪斷言），用來看跨瀏覽器的畫面差異。
  const name = testInfo.project.name;
  test.skip(!(name === 'chromium' || (name === 'webkit' && !!process.env.HIG_COLLECT)), 'HIG 場景只在 chromium 專案跑（webkit 需 HIG_COLLECT）');
});
const SHOT_DIR = process.env.HIG_SHOT_DIR || 'test-results/hig';
const COLLECT = !!process.env.HIG_COLLECT;
const MIN = 44;

const VIEWPORTS = [
  { key: 'mobile', width: 390, height: 844 },
  { key: 'desktop', width: 1280, height: 800 },
];
const SCHEMES = ['light', 'dark'];

const INTERACTIVE =
  'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=link], [role=menuitem], [role=switch], [role=checkbox], [role=radio]';

/**
 * 手機寬下，可見且可點擊、最短邊小於 44px 的元素（回傳 `標籤 寬x高`）。
 * scope（彈出層場景）：只量該 selector 內的元素，且不剔除視窗外的元素（高於一屏的對話框，
 * 下半截仍是真實的點擊目標）；回傳 measured＝實際量到幾個可見元素，用來確認量測真的涵蓋彈出層。
 */
async function tapViolations(page, scope) {
  return page.evaluate(
    ({ selector, min, labelMax, scope }) => {
      const out = new Set();
      let measured = 0;
      const roots = scope ? [...document.querySelectorAll(scope)] : [document];
      for (const el of roots.flatMap((root) => [...root.querySelectorAll(selector)])) {
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') continue;
        if (el.closest('[aria-hidden="true"], [hidden], [inert]')) continue;
        if (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)) {
          // 原生勾選框常被自訂樣式隱藏，改量它的 label／父層
        }
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (!scope && (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth)) continue;
        // 行內文字連結（段落內）不適用 44px 規則
        if (el.tagName === 'A' && style.display === 'inline') continue;
        measured++;
        if (Math.min(r.width, r.height) < min) {
          const label = (
            el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            el.textContent ||
            el.getAttribute('placeholder') ||
            el.getAttribute('data-testid') ||
            ''
          )
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, labelMax);
          out.add(`${label || '(無標籤)'} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return { found: [...out].sort(), measured };
    },
    { selector: INTERACTIVE, min: MIN, labelMax: LABEL_MAX, scope },
  );
}

for (const scene of SCENES) {
  for (const vp of VIEWPORTS.filter((v) => !scene.viewports || scene.viewports.includes(v.key))) {
    for (const scheme of SCHEMES) {
      test(`${scene.name} · ${vp.key} · ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: /** @type {'light'|'dark'} */ (scheme) });
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await setupApiMocks(page);
        await setupSceneExtras(page);
        if (scene.loggedIn === false) {
          await page.route(/\/api\/oauth\/userinfo$/, (route) =>
            route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthorized"}' }),
          );
        }
        const apiFailures = [];
        page.on('response', (res) => {
          if (res.url().includes('/api/') && res.status() >= 400) apiFailures.push(`${res.status()} ${new URL(res.url()).pathname}`);
        });
        const consoleErrors = [];
        page.on('pageerror', (e) => consoleErrors.push(String(e)));
        if (scene.stub) await scene.stub(page);
        await page.goto(scene.path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(400);
        if (scene.act) await scene.act(page);
        // 彈出層有 150～260ms 的進場動畫（淡入、上滑）；不等它跑完會拍到半透明的過場畫面。
        // 上限：Toast 只停留 2～3 秒，所以只等一小段。
        if (scene.scope) await page.waitForTimeout(600);

        // 證明渲染的是該頁面：有 proof 就必須出現；否則至少要有內容、沒有未捕捉的頁面錯誤。
        await proveScene(page, scene);
        const textLength = await page.evaluate(() => document.body.innerText.trim().length);
        // 有 proof／proofText 就已經證明內容是對的；錯誤頁（如邀請無效）本來就只有幾個字，不套用空白頁檢查。
        if (!scene.proof && !scene.proofText) expect(textLength, `${scene.name} 幾乎沒有內容（空白頁？）`).toBeGreaterThan(20);
        expect(consoleErrors, `${scene.name} 有未捕捉的頁面錯誤`).toEqual([]);

        // 場景用的 API 都該有 mock；回 4xx/5xx 代表畫面其實是錯誤態，不是想取證的那一頁
        // （未登入場景的 userinfo 401 是刻意的）。
        // 另外三個端點讀不到＝功能關閉（useAiDataConsent 與 LoginPage 都定義為「不強制」），不是錯誤態。
        const BENIGN = ['/account/ai-data-consent', '/account/ai-authorization', '/public-config'];
        // 這些場景刻意讓某個端點回 4xx/5xx（登入失敗、限流、邀請無效、清單載入失敗），那正是要取證的狀態。
        // 連狀態碼一起比對（`狀態碼 路徑`），其他狀態碼或其他端點的失敗仍然算「沒有 mock」。
        const INTENDED = { 'login-error': '401 /api/oauth/login', 'login-rate-limited': '429 /api/oauth/login', 'invite-invalid': '410 /api/invitations', 'trips-list-error': '500 /api/my-trips', 'popup-conflict-modal': '409 /api/poi-favorites', 'popup-error-banner': '500 /api/account/sessions', 'popup-toast-error': '500 /api/poi-search' };
        const unexpected = apiFailures.filter(
          (f) => !BENIGN.some((b) => f.includes(b)) && !(scene.loggedIn === false && f.includes('/oauth/userinfo')) && !(INTENDED[scene.name] && f.includes(INTENDED[scene.name])),
        );
        expect(unexpected, `${scene.name}：場景用的 API 沒有 mock，畫面可能是錯誤態`).toEqual([]);
        if (unexpected.length) console.log(`HIGNET\t${scene.name}\t${JSON.stringify([...new Set(unexpected)])}`);

        const file = path.join(SHOT_DIR, vp.key, scheme, `${scene.name}.png`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        await page.screenshot({ path: file, fullPage: false });

        // 量測只在手機寬淺色做一次（尺寸與主題無關）；只有桌機寬的表面（viewports 不含 mobile）改在桌機寬量。
        const measureVp = scene.viewports && !scene.viewports.includes('mobile') ? 'desktop' : 'mobile';
        if (vp.key !== measureVp || scheme !== 'light') return;
        const { found, measured } = await tapViolations(page, scene.scope);
        console.log(`HIGWEB\t${scene.name}\t${JSON.stringify(found)}`);
        if (scene.scope && !scene.noTargets) expect(measured, `${scene.name}：量測沒有涵蓋彈出層內的任何可點擊元素`).toBeGreaterThan(0);
        if (COLLECT) return;
        const { fresh, fixed } = diffViolations(found, KNOWN_TAP_VIOLATIONS[scene.name] ?? []);
        expect(fresh, `新增的觸控目標違規（HIG 檢查表 A1）：${scene.name}`).toEqual([]);
        expect(fixed, `已知違規已被修好，請從 hig-known-violations.js 移除：${scene.name}`).toEqual([]);
      });
    }
  }
}
