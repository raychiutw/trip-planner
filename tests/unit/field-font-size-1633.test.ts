/**
 * 表單欄位字級守門（#1633）：iOS Safari 對聚焦時字級 <16px 的文字欄位會自動放大畫面。
 * jsdom 不計算 CSS，所以掃 src／css 的來源 CSS：凡是作用在「可輸入文字欄位」的規則，只要宣告了
 * font-size，解析 token 後實際值必須 ≥16px。字級 token 以 1rem=16px 解析（手機 ≤760px 的 root 17px 只會更大，
 * 所以 16px 是下限）。真瀏覽器的實測見 tests/e2e/field-font-size-1633.spec.js；
 * e2e 在 390 寬量到 footnote 欄位 14.875px = 14px × 17/16，與這裡解析出的 14px 對得上。
 * 範圍僅限文字欄位；button（TripSelect／日期／時間 trigger）不觸發 iOS 聚焦放大，不在此列。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIN_PX = 16;

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const f = `${dir}/${n}`;
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(tsx?|css)$/.test(n)) out.push(f);
  }
  return out;
}

/** 字級 token 表（css/tokens.css 的 --font-size-* ／ --text-*），值換算成 px。 */
function tokenPx(): Map<string, number> {
  const css = readFileSync('css/tokens.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const raw = new Map<string, string>();
  for (const m of css.matchAll(/(--(?:font-size|text)-[\w-]+)\s*:\s*([^;]+);/g)) if (!raw.has(m[1])) raw.set(m[1], m[2].trim());
  const out = new Map<string, number>();
  const resolve = (name: string, depth = 0): number | undefined => {
    const v = raw.get(name);
    if (!v || depth > 5) return undefined;
    return toPx(v, (n) => resolve(n, depth + 1));
  };
  for (const k of raw.keys()) { const px = resolve(k); if (px !== undefined) out.set(k, px); }
  return out;
}

function toPx(v: string, tok: (name: string) => number | undefined): number | undefined {
  const s = v.trim();
  let m = s.match(/^([\d.]+)rem$/); if (m) return parseFloat(m[1]) * 16;
  m = s.match(/^([\d.]+)px$/); if (m) return parseFloat(m[1]);
  m = s.match(/^var\((--[\w-]+)\)$/); if (m) return tok(m[1]);
  return undefined; // inherit／em／max()／calc() 等：交給呼叫端判斷
}

const TOKENS = tokenPx();

const NON_TEXT_TYPE = /\[type=["']?(checkbox|radio|button|submit|reset|image|file|hidden|range|color)["']?\]/;

/** 選擇器最後一個複合選擇器是否為「可輸入文字欄位」：input／textarea／select 標籤，或以 -input／-textarea／-search 結尾的 class。 */
function targetsTextField(selector: string): boolean {
  if (/::/.test(selector)) return false; // ::placeholder 等偽元素
  const last = selector.trim().split(/[\s>+~]+/).pop() ?? '';
  if (NON_TEXT_TYPE.test(last)) return false;
  const base = last.replace(/:[\w-]+(\([^)]*\))?/g, ''); // 去掉 :focus／:hover 等偽類
  return /(^|[^\w-])(input|textarea|select)(?![\w-])/.test(base) || /\.[\w-]*(-input|-textarea|-search|-field)(?![\w-])/.test(base);
}

interface Hit { file: string; selector: string; value: string; px?: number }

/**
 * 掃來源 CSS，回傳「手機（390 寬）有效」的欄位字級：每個 file+selector 取來源順序最後一筆
 * （近似 cascade；@media (max-width…) 內的覆寫算數，min-width／print 等桌機情境的規則不算）。
 * shortcut：不比對 specificity，只看來源順序；桌機／iPad 寬度不在此守，要擴大時再依 @media 分寬度。
 */
function collect(): Hit[] {
  const last = new Map<string, Hit>();
  for (const file of [...walk('src'), ...walk('css')]) {
    const clean = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const stack: boolean[] = []; // 目前是否位於「手機不適用」的 @media 內
    for (const m of clean.matchAll(/(@[\w-]+[^{};]*)\{|([^{}@]+)\{([^{}]*)\}|\}/g)) {
      if (m[1] !== undefined) { // at-rule 開頭
        const cond = m[1];
        stack.push(/^@media/.test(cond) ? /min-width|print|prefers-reduced|hover:\s*hover/.test(cond) : false);
      } else if (m[2] === undefined) { stack.pop(); } else {
        if (stack.some(Boolean)) continue;
        const fs = m[3].match(/(?:^|[;\s])font-size\s*:\s*([^;}]+)/);
        if (!fs) continue;
        for (const raw of m[2].split(',')) {
          const selector = raw.trim().replace(/\s+/g, ' ');
          if (!selector || !targetsTextField(selector)) continue;
          const value = fs[1].trim();
          last.set(`${file}|${selector}`, { file, selector, value, px: toPx(value, (n) => TOKENS.get(n)) });
        }
      }
    }
  }
  return [...last.values()];
}

describe('文字欄位字級 ≥16px（#1633）', () => {
  it('token 解析正確：body／callout 16、headline 17、footnote 14、subheadline 15', () => {
    expect(TOKENS.get('--font-size-body')).toBe(16);
    expect(TOKENS.get('--font-size-callout')).toBe(16);
    expect(TOKENS.get('--font-size-headline')).toBe(17);
    expect(TOKENS.get('--font-size-subheadline')).toBe(15);
    expect(TOKENS.get('--font-size-footnote')).toBe(14);
  });

  it('全域 input／select／textarea 仍有 max(16px, 1em) 下限（沒寫 font-size 的欄位靠它）', () => {
    const css = readFileSync('css/tokens.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/input,\s*select,\s*textarea\s*\{\s*font-size:\s*max\(16px,\s*1em\)/);
  });

  it('掃得到一定數量的欄位規則（掃描器沒壞）', () => {
    expect(collect().length).toBeGreaterThan(25);
  });

  it('作用在文字欄位的 font-size 宣告全部 ≥16px', () => {
    const bad = collect()
      // inherit／em／max() 等無法靜態換算者：只允許 inherit（吃全域 max(16px,1em) 下限）與 max(16px…)
      .filter((h) => (h.px === undefined ? !/^(inherit|max\(16px)/.test(h.value) : h.px < MIN_PX))
      .map((h) => `${h.file} | ${h.selector} | font-size: ${h.value}${h.px === undefined ? '' : ` (${h.px}px)`}`);
    expect(bad, `字級 <16px（iOS 聚焦會放大畫面）：\n${bad.join('\n')}`).toEqual([]);
  });
});
