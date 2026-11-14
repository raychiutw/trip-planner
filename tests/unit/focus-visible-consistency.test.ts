/**
 * 表單欄位焦點外框一致性守門（#1595 搜尋框、#1628 textarea 的統一寫法）。
 * jsdom 不計算 CSS，所以掃來源 CSS 字串：每個目標欄位都要有 `:focus-visible` 規則畫
 * `outline: 2px solid var(--color-focus-ring)`；而且任何 `:focus` 規則都不得再用 `outline: none`
 * 蓋掉外框（沒有對應 :focus-visible 規則的話，鍵盤使用者只剩 1px 邊框色變化）。
 * 真瀏覽器的實測見 tests/e2e/form-focus-visible.spec.js。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Rule { selectors: string[]; body: string }

function read(file: string): string {
  return readFileSync(file, 'utf8');
}

/** 極簡 CSS 解析：拿掉註解後，取所有最內層 `selector { body }`（@media 內的規則也會被取到）。 */
function parseRules(css: string): Rule[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = splitSelectors(m[1]);
    rules.push({ selectors, body: m[2] });
  }
  return rules;
}

/** 以頂層逗號切選擇器（括號內的逗號，如 :where(a, b)，不切）。 */
function splitSelectors(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of raw) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim().replace(/\s+/g, ' ')); cur = ''; } else cur += ch;
  }
  out.push(cur.trim().replace(/\s+/g, ' '));
  return out.filter(Boolean);
}

const RING = /outline:\s*2px solid var\(--color-focus-ring\)/;

/** 目標：file + 欄位選擇器片段（選擇器要「包含」該片段且含 :focus-visible）。 */
const TARGETS: Array<[file: string, fragment: string]> = [
  ['src/pages/AddStopPage.tsx', '.tp-add-stop-search-input'],
  ['src/pages/AddStopPage.tsx', '.tp-add-stop-form-field textarea'],
  ['src/pages/AddStopPage.tsx', '.tp-add-stop-form-field input'],
  ['src/components/trip/CustomPoiForm.tsx', '.tp-custom-poi-form-field textarea'],
  ['src/components/trip/CustomPoiForm.tsx', '.tp-custom-poi-form-field input'],
  ['src/components/trip/CollabPanel.tsx', '.tp-collab-add-input'],
  ['src/components/shared/InputModal.tsx', '.tp-input-field'],
  ['src/pages/ChatPage.tsx', '.tp-chat-input'],
  ['src/pages/EntryActionPage.tsx', '.tp-entry-action-time-select'],
  ['src/pages/ChangePoiPage.tsx', '.tp-change-poi-search input'],
  ['src/pages/EditEntryPage.tsx', '.tp-edit-entry-desc-input'],
  ['src/pages/EditEntryPage.tsx', '.tp-edit-entry-transit input'],
  ['src/pages/EditEntryPage.tsx', '.tp-poi-note-input'],
  ['src/pages/ExplorePage.tsx', '.explore-search'],
  ['src/pages/PoiFavoritesPage.tsx', '.favorites-search'],
  ['css/tokens.css', '.tp-input-long'],
  ['css/tokens.css', '.tp-input-short:has('],
  ['css/tokens.css', 'input.tp-input-short'],
  ['css/tokens.css', 'select.tp-input-short'],
  ['src/components/trip/_tripFormStyles.ts', '.tp-new-form-row input'],
  ['src/components/trip/_tripFormStyles.ts', '.tp-new-form-row textarea'],
  ['src/components/trip/_tripFormStyles.ts', '.tp-edit-row input[type="text"]'],
  ['src/components/trip/_tripFormStyles.ts', '.tp-edit-row textarea'],
  ['src/components/trip/_tripFormStyles.ts', '.tp-edit-row select'],
  // 稽核時另外發現的同型欄位
  ['css/tokens.css', ':where('],
  ['css/tokens.css', '.tp-titlebar-trip-search'],
  ['css/tokens.css', '.tp-form-row > input'],
  ['css/tokens.css', '.tp-form-row > textarea'], // 全域 input/textarea/select baseline
  ['src/components/trip/TravelPillDialog.tsx', '.tp-travel-detail input'],
  ['src/components/trip/TimelineRail.styles.ts', '.tp-rail-note-input'],
  ['src/components/TripDatePicker.styles.ts', '.tp-date-trigger'],
  ['src/components/TripSelect.styles.ts', '.tp-select-trigger'],
  ['src/components/TripTimePicker.styles.ts', '.tp-time-trigger'],
];

describe('表單欄位 :focus-visible 外框一致', () => {
  for (const [file, fragment] of TARGETS) {
    it(`${file} ${fragment} 有 :focus-visible 2px focus-ring 規則`, () => {
      const hit = parseRules(read(file)).filter((r) =>
        r.selectors.some((s) => s.includes(fragment) && s.includes(':focus-visible')) && RING.test(r.body));
      expect(hit.length, `${file} 找不到 ${fragment}:focus-visible { outline: 2px solid var(--color-focus-ring) }`).toBeGreaterThan(0);
      // offset 2px，與 #1595 / #1628 範本一致
      expect(hit.some((r) => /outline-offset:\s*2px/.test(r.body)), 'outline-offset: 2px').toBe(true);
    });
  }
});

describe('不得有 :focus 規則用 outline:none 蓋掉外框', () => {
  const FILES = [...new Set(TARGETS.map(([f]) => f))];
  // 程式聚焦的容器（tabIndex=-1，非使用者可聚焦控制項），有意不顯外框
  // typeahead 候選項以整列底色表示焦點（非表單欄位本身）
  const ALLOW = ['.app-shell-sheet > [tabindex="-1"]:focus', '.tp-custom-poi-typeahead-item:focus-visible',
    // 選單項目以整列底色表示焦點（非表單欄位）
    '.tp-rail-menu-item:focus-visible'];
  for (const file of FILES) {
    it(`${file}`, () => {
      const rules = parseRules(read(file));
      const bad: string[] = [];
      for (const r of rules) {
        if (!/outline:\s*none/.test(r.body)) continue;
        for (const s of r.selectors) {
          // :focus（不含 -visible）或 :focus-visible 搭配 outline:none 都算蓋掉
          if (!/:focus(?!-)|:focus-visible/.test(s) && !/:focus-within/.test(s)) continue;
          if (ALLOW.includes(s)) continue;
          if (/:focus-within/.test(s)) continue; // 容器 :focus-within 另由 TARGETS 的 :has(:focus-visible) 規則守
          bad.push(s);
        }
      }
      expect(bad, `${file} 的焦點規則仍含 outline:none`).toEqual([]);
    });
  }
});

describe('全站掃描：任何 :focus／:focus-visible 規則都不得用 outline:none（除白名單）', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const n of readdirSync(dir)) {
      const f = `${dir}/${n}`;
      if (statSync(f).isDirectory()) walk(f, out);
      else if (/\.(tsx?|css)$/.test(n)) out.push(f);
    }
    return out;
  }
  // 程式聚焦容器／選單項目底色／typeahead 候選項底色，皆非表單欄位本身，有意不畫外框
  const ALLOW = new Set([
    '.app-shell-sheet > [tabindex="-1"]:focus',
    '.app-shell-sheet > [tabindex="-1"]:focus-visible',
    '.tp-custom-poi-typeahead-item:focus-visible',
    '.tp-custom-stop-typeahead-item:focus',
    '.tp-rail-menu-item:focus-visible',
    // 按鈕本身不畫，外框改畫在子元素／容器（已有 2px focus-ring 規則）
    '.tp-account-circle:focus-visible',
    '.tp-notes-section-toggle:focus-visible',
  ]);
  it('src 與 css 下沒有漏網', () => {
    const bad: string[] = [];
    for (const f of [...walk('src'), ...walk('css')]) {
      for (const r of parseRules(read(f))) {
        if (!/outline:\s*none/.test(r.body)) continue;
        for (const s of r.selectors) {
          if (/:focus(?!-within)/.test(s) && !ALLOW.has(s)) bad.push(`${f}: ${s}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
