/**
 * 毛玻璃面 module 的守門（architecture review #1 / #1422 的根因）。
 *
 * #1422 的病灶是「recipe 被 8 個 call site 各抄一份」：新增玻璃面時漏寫 `--glass-reduce-*`
 * fallback，沒有任何東西會紅。module 化之後：recipe 只在 tokens.css 的 `.tp-glass` 寫一次，
 * call site 只宣告兩個參數（--glass-alpha、--glass-filter）並加上 class。
 *
 * 這裡守「結構」：recipe 只有一份、降級 token 只定義一次、沒有人再手寫裸的 backdrop-filter。
 * 「降級後瀏覽器裡真的不透明、無模糊」由 tests/e2e/glass-degrade.spec.js 用 computed style 守，
 * 兩者缺一不可（原始碼 grep 全綠、瀏覽器沒降級，正是 2026-10 發生過的事）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../..');
const CSS = readFileSync(join(ROOT, 'css/tokens.css'), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}
const SRC = walk(join(ROOT, 'src')).map((p) => ({ p: p.slice(ROOT.length + 1), s: readFileSync(p, 'utf8') }));
const SRC_AND_TOKENS = [...SRC, { p: 'css/tokens.css', s: CSS }];

/** 去掉區塊註解，避免註解裡提到 token 名字造成誤判。 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('毛玻璃面 module', () => {
  it('.tp-glass 在 tokens.css 定義一次：背景與 filter 都走降級 token，且不成對寫 -webkit-', () => {
    const css = strip(CSS);
    const rules = css.match(/(^|\n)\s*\.tp-glass\s*\{[^}]*\}/g) ?? [];
    expect(rules.length, '.tp-glass 應恰好定義一次').toBe(1);
    const rule = rules[0];
    expect(rule).toMatch(/background:\s*var\(--glass-reduce-bg,/);
    expect(rule).toMatch(/(^|[^-])backdrop-filter:\s*var\(--glass-reduce-filter,/);
    // lightningcss 會把成對的 backdrop-filter／-webkit-backdrop-filter 去重並留下 Chromium 不認得的 -webkit- 版
    // → 整面玻璃在 Chrome 失效（2026-10 重構時實際發生）。只准寫標準屬性。
    expect(rule).not.toMatch(/-webkit-backdrop-filter/);
  });

  it('降級 token 只在一個區塊定義一次（不再 reduce-transparency／contrast 各抄一份）', () => {
    const css = strip(CSS);
    const defs = css.match(/--glass-reduce-filter:\s*none/g) ?? [];
    expect(defs.length).toBe(1);
  });

  it('call site 不再手寫 --glass-reduce-bg fallback（recipe 只有 .tp-glass 一份）', () => {
    const offenders = SRC.filter(({ s }) => /var\(\s*--glass-reduce-bg/.test(strip(s))).map(({ p }) => p);
    expect(offenders).toEqual([]);
  });

  it('每個 backdrop-filter 宣告都走降級機制（不允許裸的 blur(...)）', () => {
    // 允許：.tp-glass／探索頁 scrim 的 --glass-reduce-filter、tab bar 家族的 --tabbar-filter、
    // --blur-glass（降級時為 0px；底部列另有明確的不透明覆寫）。掃 src 與 tokens.css 本身。
    const ok = /--glass-reduce-filter|--tabbar-filter|--blur-glass|var\(--glass-filter/;
    const bad: string[] = [];
    // (?<!\() 排除 `@supports (backdrop-filter: …)` 這類 feature query，它不是宣告。
    for (const { p, s } of SRC_AND_TOKENS) {
      for (const m of strip(s).matchAll(/(?<!\()(?:-webkit-)?backdrop-?[fF]ilter\s*:\s*([^;\n]+)/g)) {
        if (!ok.test(m[1])) bad.push(`${p}: ${m[0].trim()}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
