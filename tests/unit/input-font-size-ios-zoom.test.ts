/**
 * input-font-size-ios-zoom.test.ts — iOS 聚焦放大防護
 *
 * 使用者回報「點輸入框視窗會放大、然後開始左右滑動」。root cause：iOS Safari 在
 * 聚焦的文字輸入框 computed font-size < 16px 時會自動放大 viewport，放大後頁面比
 * viewport 寬 → 可左右橫滑。
 *
 * css/tokens.css base 規則 `button, input, select, textarea { font-size: inherit }`
 * 讓沒套 .tp-input-long / .tp-input-short 的 stray input 繼承父層字級；父層若是
 * footnote(14px)/caption(12px)/caption2(11px) 就 <16px → 放大。
 *
 * 修法：對 input/select/textarea 疊 `font-size: max(16px, 1em)` — 大於 16px 的
 * 保留、小於拉到 16px 底線；buttons 不含（不觸發放大）。此 test 防止 regression。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TOKENS = readFileSync(path.resolve(__dirname, '../../css/tokens.css'), 'utf8');

describe('iOS input zoom prevention (font-size ≥ 16px)', () => {
  it('floors text inputs at 16px via max(16px, 1em) — kills iOS focus-zoom', () => {
    expect(TOKENS).toMatch(
      /input,\s*select,\s*textarea\s*\{[^}]*font-size:\s*max\(\s*16px\s*,\s*1em\s*\)/,
    );
  });

  it('does NOT floor <button> (buttons do not trigger focus-zoom)', () => {
    // The max(16px,1em) rule must target input/select/textarea only, not button.
    const m = TOKENS.match(/([^\n{};]*)\{\s*font-size:\s*max\(\s*16px\s*,\s*1em\s*\)/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/button/);
  });

  it('keeps the .tp-input-long (16px) / .tp-input-short (22px) systems intact', () => {
    expect(TOKENS).toMatch(/\.tp-input-long\s*\{[\s\S]*?font-size:\s*var\(--font-size-body\)/);
    expect(TOKENS).toMatch(/\.tp-input-short input[\s\S]*?font-size:\s*22px/);
  });

  it('--font-size-body resolves to 16px (the iOS zoom threshold)', () => {
    expect(TOKENS).toMatch(/--font-size-body:\s*1rem/);
  });
});
