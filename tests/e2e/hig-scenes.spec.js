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
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');
const { KNOWN_TAP_VIOLATIONS } = require('./hig-known-violations');

const TRIP = MOCK_TRIPS_LIST[0].tripId;

// 量測的尺寸與字型度量依瀏覽器引擎而異；已知違規清單只以 chromium 為準，其他 project 不跑，避免棘輪在 webkit 誤紅。
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'HIG 場景只在 chromium 專案跑');
});
const SHOT_DIR = process.env.HIG_SHOT_DIR || 'test-results/hig';
const COLLECT = !!process.env.HIG_COLLECT;
const MIN = 44;

const VIEWPORTS = [
  { key: 'mobile', width: 390, height: 844 },
  { key: 'desktop', width: 1280, height: 800 },
];
const SCHEMES = ['light', 'dark'];

/**
 * @typedef {{ name: string, path: string, loggedIn?: boolean, proof?: string }} Scene
 * proof：頁面渲染完成時一定存在的 data-testid；沒有時退而求其次檢查沒有錯誤頁。
 */
/** @type {Scene[]} */
const SCENES = [
  { name: 'landing', path: '/', loggedIn: false },
  { name: 'login', path: '/login', loggedIn: false },
  { name: 'signup', path: '/signup', loggedIn: false },
  { name: 'forgot-password', path: '/login/forgot', loggedIn: false },
  { name: 'privacy', path: '/privacy', loggedIn: false },
  { name: 'trips-list', path: '/trips', proof: 'trips-list-page' },
  { name: 'trips-new', path: '/trips/new' },
  { name: 'explore', path: '/explore' },
  { name: 'favorites', path: '/favorites' },
  { name: 'chat', path: '/chat' },
  { name: 'map', path: '/map' },
  { name: 'account', path: '/account' },
  { name: 'account-appearance', path: '/account/appearance' },
  { name: 'account-notifications', path: '/account/notifications' },
  { name: 'account-sessions', path: '/account/sessions' },
  { name: 'account-connected-apps', path: '/account/connected-apps' },
  { name: 'developer-apps', path: '/developer/apps' },
  { name: 'developer-apps-new', path: '/developer/apps/new' },
  { name: 'trip-detail', path: `/trip/${TRIP}` },
  { name: 'trip-map', path: `/trip/${TRIP}/map` },
  { name: 'trip-notes', path: `/trip/${TRIP}/notes` },
  { name: 'trip-print', path: `/trip/${TRIP}/print` },
  { name: 'trip-collab', path: `/trip/${TRIP}/collab` },
  { name: 'trip-health', path: `/trip/${TRIP}/health` },
  { name: 'trip-edit', path: `/trip/${TRIP}/edit` },
  { name: 'trip-add-stop', path: `/trip/${TRIP}/add-stop` },
  { name: 'trip-add-entry', path: `/trip/${TRIP}/add-entry` },
];

const INTERACTIVE =
  'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=link], [role=menuitem], [role=switch], [role=checkbox], [role=radio]';

/** 手機寬下，可見且可點擊、最短邊小於 44px 的元素（回傳 `標籤 寬x高`）。 */
async function tapViolations(page) {
  return page.evaluate(
    ({ selector, min }) => {
      const out = new Set();
      for (const el of document.querySelectorAll(selector)) {
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') continue;
        if (el.closest('[aria-hidden="true"], [hidden], [inert]')) continue;
        if (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)) {
          // 原生勾選框常被自訂樣式隱藏，改量它的 label／父層
        }
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
        // 行內文字連結（段落內）不適用 44px 規則
        if (el.tagName === 'A' && style.display === 'inline') continue;
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
            .slice(0, 24);
          out.add(`${label || '(無標籤)'} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return [...out].sort();
    },
    { selector: INTERACTIVE, min: MIN },
  );
}

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** 預設 api-mocks 沒涵蓋、但場景頁面會打的端點。沒有它們頁面會落到錯誤態，取證的就不是想看的那一頁。
 * 形狀照 design-review-guard.spec.js 與各 spec 的既有 fixture。 */
async function setupSceneExtras(page) {
  const idle = (docType) => ({ docType, status: 'idle', jobId: null, requestId: null, generation: 0, exclusionCount: 0 });
  await page.route(new RegExp(`/api/trips/${TRIP}/notes/ai-state$`), (r) =>
    r.fulfill(json({ jobs: [idle('tips'), idle('lodging-tips'), idle('emergency')] })));
  await page.route(new RegExp(`/api/trips/${TRIP}/notes$`), (r) =>
    r.fulfill(json({
      flights: [{ id: 1, sortOrder: 0, airline: '中華航空', flightNo: 'CI 120', cabinClass: '', departAirport: 'TPE', arriveAirport: 'OKA', departAt: '2026-07-26T09:35', arriveAt: '2026-07-26T12:00', note: '', version: 0 }],
      lodgings: [], reservations: [], pretripNotes: [],
      emergencyContacts: [{ id: 1, sortOrder: 0, name: '日本警察', relationship: '報案', phone: '110', email: '', kind: 'police', aiGenerated: 0, origin: 'human', managedBy: 'human', semanticKey: null, version: 0 }],
    })));
  await page.route(new RegExp(`/api/trips/${TRIP}/segments$`), (r) =>
    r.fulfill(json([{ id: 1, tripId: TRIP, fromEntryId: 101, toEntryId: 102, mode: 'driving', submode: null, min: 13, distanceM: 6600, source: 'google', computedAt: 1, updatedAt: 1, noTravel: null }])));
  await page.route(new RegExp(`/api/trips/${TRIP}/health-check$`), (r) => r.fulfill(json({ report: null })));
  await page.route('**/api/requests**', (r) => r.fulfill(json({ items: [], hasMore: false })));
  await page.route('**/api/dev/apps', (r) => {
    if (r.request().method() !== 'GET') return r.fallback();
    return r.fulfill(json({ apps: [{ client_id: 'tp_app', app_name: 'Travel App', client_type: 'public', redirect_uris: [], allowed_scopes: ['openid'], status: 'active', created_at: '2026-09-26T00:00:00Z' }] }));
  });
  // 擋外部地圖服務，避免畫面隨外部狀態飄；路線 API 回空。
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  await page.route('**/api/route**', (r) => r.fulfill(json({ polyline: [], duration: null, distance: 0, approx: true })));
}

for (const scene of SCENES) {
  for (const vp of VIEWPORTS) {
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
        await page.goto(scene.path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(400);

        // 證明渲染的是該頁面：有 proof 就必須出現；否則至少要有內容、沒有未捕捉的頁面錯誤。
        if (scene.proof) await expect(page.getByTestId(scene.proof)).toBeVisible();
        const textLength = await page.evaluate(() => document.body.innerText.trim().length);
        expect(textLength, `${scene.name} 幾乎沒有內容（空白頁？）`).toBeGreaterThan(20);
        expect(consoleErrors, `${scene.name} 有未捕捉的頁面錯誤`).toEqual([]);

        // 場景用的 API 都該有 mock；回 4xx/5xx 代表畫面其實是錯誤態，不是想取證的那一頁
        // （未登入場景的 userinfo 401 是刻意的）。
        // 另外三個端點讀不到＝功能關閉（useAiDataConsent 與 LoginPage 都定義為「不強制」），不是錯誤態。
        const BENIGN = ['/account/ai-data-consent', '/account/ai-authorization', '/public-config'];
        const unexpected = apiFailures.filter(
          (f) => !BENIGN.some((b) => f.includes(b)) && !(scene.loggedIn === false && f.includes('/oauth/userinfo')),
        );
        expect(unexpected, `${scene.name}：場景用的 API 沒有 mock，畫面可能是錯誤態`).toEqual([]);
        if (unexpected.length) console.log(`HIGNET\t${scene.name}\t${JSON.stringify([...new Set(unexpected)])}`);

        const file = path.join(SHOT_DIR, vp.key, scheme, `${scene.name}.png`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        await page.screenshot({ path: file, fullPage: false });

        if (vp.key !== 'mobile' || scheme !== 'light') return; // 量測只在手機寬淺色做一次（尺寸與主題無關）
        const found = await tapViolations(page);
        console.log(`HIGWEB\t${scene.name}\t${JSON.stringify(found)}`);
        if (COLLECT) return;
        const known = new Set(KNOWN_TAP_VIOLATIONS[scene.name] ?? []);
        const fresh = found.filter((v) => !known.has(v));
        const fixed = [...known].filter((v) => !found.includes(v));
        expect(fresh, `新增的觸控目標違規（HIG 檢查表 A1）：${scene.name}`).toEqual([]);
        expect(fixed, `已知違規已被修好，請從 hig-known-violations.js 移除：${scene.name}`).toEqual([]);
      });
    }
  }
}
