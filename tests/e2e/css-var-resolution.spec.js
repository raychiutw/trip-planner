/**
 * 瀏覽器實際載入的樣式裡，每個沒有 fallback 的 var(--x) 都要找得到 --x 的定義。
 *
 * 掃兩處：樣式表規則，以及元素屬性（SVG fill／stroke、style）裡的 var()。
 * 原始碼層守門（tests/unit/css-var-defined.test.ts）看不到 build 產物：@theme 裡的變數
 * 若 Tailwind 掃不到名字就會被 tree-shake 掉 —— 原始碼有、瀏覽器沒有。這支直接掃 CSSOM。
 * 頁面清單 = 2026-09-24 修過未定義變數的地方（落地頁插畫 + 另外 5 處）；
 * 各頁的 SCOPED_STYLES 只在頁面掛載時注入，所以要逐頁打開再掃。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

/**
 * 回傳目前頁面樣式裡「有引用、沒定義」的變數，格式 `--x ← selector`。
 * ponytail: 「有定義」＝任何規則或 style 屬性宣告過，不看選擇器是否命中、主題／media 是否生效、
 * inline 定義是否在祖先上；@keyframes 內容不掃。要更嚴再改成逐元素 getComputedStyle 比對。
 */
function undefinedVars(page) {
  return page.evaluate(() => {
    const defined = new Set();
    const refs = new Map();
    const walk = (rules) => {
      for (const rule of rules) {
        if (typeof CSSPropertyRule !== 'undefined' && rule instanceof CSSPropertyRule) { defined.add(rule.name); continue; }
        if (rule.cssRules) walk(rule.cssRules); // @media／@supports／@layer／巢狀規則
        if (!(rule instanceof CSSStyleRule)) continue;
        const text = rule.style.cssText;
        for (const m of text.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
        for (const m of text.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) refs.set(m[1], rule.selectorText);
      }
    };
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; } // 跨網域樣式表（字型）讀不到
      walk(rules);
    }
    for (const el of document.querySelectorAll('*')) {
      for (const attr of el.attributes) {
        if (attr.name === 'style') for (const m of attr.value.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
        for (const m of attr.value.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) refs.set(m[1], `<${el.localName} ${attr.name}>`);
      }
    }
    // react-day-picker 自己的 style.css 只引用、從不定義 --rdp-weekday-text-transform 這類客製 hook
    // （沒定義＝瀏覽器預設），不是我們的變數。
    return [...refs].filter(([name]) => !defined.has(name) && !name.startsWith('--rdp-'))
      .map(([name, sel]) => `${name} ← ${sel}`);
  });
}

test('逐頁掃描：樣式裡引用的 CSS 變數都有定義（build 產物）', async ({ page }) => {
  // 落地頁要未登入才看得到 —— 先掃，再掛 mock 登入
  await page.goto('/');
  await page.getByTestId('landing-page').waitFor();
  expect.soft(await undefinedVars(page), '落地頁').toEqual([]);

  await setupApiMocks(page);
  const tripId = MOCK_TRIPS_LIST[0].tripId;

  await page.goto(`/chat?tripId=${tripId}`);
  await page.getByTestId('chat-input').waitFor();
  expect.soft(await undefinedVars(page), '聊天頁（含 AppShell）').toEqual([]);

  await page.goto(`/trip/${tripId}/collab`);
  await page.locator('.tp-collab-page-title').waitFor();
  expect.soft(await undefinedVars(page), '協作頁').toEqual([]);

  await page.goto(`/trip/${tripId}/stop/101/edit`);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('style')]
    .some((s) => s.textContent.includes('alt-extra-chip')))).toBe(true);
  expect.soft(await undefinedVars(page), '編輯行程點').toEqual([]);

  const favorite = await page.evaluate(() => fetch('/api/poi-favorites', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ poiId: 1 }),
  }).then((res) => res.json()));
  await page.goto(`/favorites/${favorite.id}/add-to-trip`);
  await page.locator('.tp-favorites-add-to-trip').first().waitFor();
  expect.soft(await undefinedVars(page), '收藏加入行程').toEqual([]);
});
