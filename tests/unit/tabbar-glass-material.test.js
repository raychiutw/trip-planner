/**
 * 底部 tab 膠囊的玻璃材質
 *
 * 沿革（同一個地方來回三次，所以這裡把每一次的原因寫下來）：
 *   1. 原本 `--color-glass-nav` = `color-mix(--color-background 92%, transparent)`
 *      → 92% 奶油色疊在奶油色頁面上，owner 2026-07-20 反映「像實心白條」。
 *   2. 於是 v2.56.6 把材質**整個刪成 transparent**，icon 靠陰影自己撐可讀性。
 *      owner 2026-07-21 反映「沒有玻璃化效果，變成全透明」。
 *   3. 曾提過改用 `rgba(255,255,255,0.80)`（PR #1092），owner 判斷「會造成白底」——
 *      正確：80% 白在奶油頁上仍然是一條白帶，只是換個顏色重演第 1 次的問題。
 *
 * 結論：問題從來不是「要不要玻璃」，是 **tint 的不透明度**。tint 一高，
 * backdrop-filter 就沒有表現空間，材質退化成一塊實心色板。
 *
 * iOS HIG 的玻璃感來自「**低 tint + 強模糊 + 提高飽和度**」——
 * 底下的內容真的透出來並被放大彩度，才會讀作玻璃而非面板。
 * 這支測試把「tint 不得過高」與「必須有模糊與飽和度」鎖起來，
 * 避免第四次又調回不透明。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TOKENS = readFileSync(join(__dirname, '../../css/tokens.css'), 'utf8');
const NAV = readFileSync(
  join(__dirname, '../../src/components/shell/GlobalBottomNav.tsx'), 'utf8');

/** 取某個 custom property 的值（最後一次宣告勝出前的第 N 個，用 all 再挑）。 */
function declarations(css, name) {
  const re = new RegExp(`--${name}\\s*:\\s*([^;]+);`, 'g');
  return [...css.matchAll(re)].map((m) => m[1].trim());
}

describe('tab 膠囊材質 token', () => {
  it('有定義 tint / filter，且淺色深色各一份', () => {
    expect(declarations(TOKENS, 'tabbar-tint').length,
      '應有淺色與深色兩份 tint').toBeGreaterThanOrEqual(2);
    expect(declarations(TOKENS, 'tabbar-filter').length).toBeGreaterThanOrEqual(1);
  });

  // 只檢查「玻璃態」的宣告。降級態（prefers-reduced-transparency / 不支援
  // backdrop-filter）刻意是不透明色與 filter:none，把它們一起檢查會誤判。
  const glassTints = () =>
    declarations(TOKENS, 'tabbar-tint').filter((v) => /^rgba?\(/.test(v));
  const glassFilters = () =>
    declarations(TOKENS, 'tabbar-filter').filter((v) => v !== 'none');

  it('tint 的 alpha 必須夠低，底下內容才透得出來', () => {
    // 這條是整個修復的核心。0.92（原本）與 0.80（提案）都會讓
    // backdrop-filter 幾乎不起作用 → 視覺上就是一塊實心色板。
    const tints = glassTints();
    expect(tints.length, '應至少有淺色與深色兩份玻璃 tint').toBeGreaterThanOrEqual(2);
    for (const value of tints) {
      const alpha = Number(value.match(/rgba?\([^)]*?,\s*([\d.]+)\s*\)/)?.[1]);
      expect(alpha, `tint「${value}」的 alpha 過高，會退化成實心色板`).toBeLessThanOrEqual(0.6);
    }
  });

  it('filter 同時有模糊與飽和度 —— 只有模糊不足以讀作玻璃', () => {
    const filters = glassFilters();
    expect(filters.length).toBeGreaterThanOrEqual(1);
    for (const value of filters) {
      expect(value, `「${value}」缺少 blur`).toMatch(/blur\(/);
      expect(value, `「${value}」缺少 saturate —— 彩度提升才是玻璃感來源`).toMatch(/saturate\(/);
    }
  });

  it('模糊半徑要夠大（14px 這種弱模糊看不出材質）', () => {
    for (const value of glassFilters()) {
      const px = Number(value.match(/blur\((\d+(?:\.\d+)?)px\)/)?.[1]);
      expect(px, `blur ${px}px 太弱`).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('GlobalBottomNav 套用材質', () => {
  const capsule = NAV.slice(
    NAV.indexOf('.tp-global-bottom-nav {'),
    NAV.indexOf('.tp-global-bottom-nav-btn'),
  );

  it('容器不再是 background: transparent', () => {
    expect(capsule, '仍是全透明').not.toMatch(/background:\s*transparent/);
  });

  it('容器用 tabbar token，且帶 -webkit- 前綴（Safari 需要）', () => {
    expect(capsule).toMatch(/background:\s*var\(--tabbar-tint\)/);
    expect(capsule).toMatch(/backdrop-filter:\s*var\(--tabbar-filter\)/);
    expect(capsule, 'iOS Safari 需要 -webkit-backdrop-filter').toMatch(
      /-webkit-backdrop-filter:\s*var\(--tabbar-filter\)/);
  });
});

describe('可及性降級', () => {
  it('prefers-reduced-transparency 時改用不透明底', () => {
    // 開啟「降低透明度」的使用者拿不到 backdrop-filter 的效果，
    // 若只留低 alpha tint，膠囊會變成幾乎看不見的浮片。
    expect(TOKENS).toMatch(/prefers-reduced-transparency/);
  });

  it('不支援 backdrop-filter 的瀏覽器有 fallback', () => {
    expect(TOKENS).toMatch(/@supports\s+not\s*\(backdrop-filter/);
  });
});
