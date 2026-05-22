// @vitest-environment node
/**
 * v2.31.33 fix #134: AddStopPage counter mobile 191px 容不下完整 dayLabel
 * → 簡化「將加入 DAY 01 · 7/29（三）」為「→ DAY 01」短 day index。
 *
 * Bug 取證（mobile prod QA）：「已選 0 個 · 將加入 DAY 01 · 7/29（三）」248px > counter
 * 191px = overflow 57px → ellipsis 切成「... · ...」。
 *
 * Fix：counter 不顯 dayLabel（含 date 字串），改顯短「→ DAY NN」。Page header 上方
 * 已顯完整 dayLabel（含 date + weekday），counter 不重複。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/AddStopPage.tsx'),
  'utf8',
);

describe('v2.31.33 AddStopPage counter shorten', () => {
  it('counter 用「→ DAY {dayNum}」格式（不再 dayLabel + 將加入）', () => {
    // 短格式「已選 N 個 → DAY 01」
    expect(SRC).toMatch(/已選\s*<strong>\{totalSelected\}<\/strong>\s*個\s*→\s*DAY/);
    expect(SRC).toMatch(/String\(dayNum\)\.padStart\(2,\s*'0'\)/);
  });

  it('counter 不再含「將加入 {dayLabel}」表述', () => {
    // 取 add-stop-counter span 周邊 300 chars 確認該段不含舊 phrase
    const counterIdx = SRC.indexOf('data-testid="add-stop-counter"');
    expect(counterIdx).toBeGreaterThan(0);
    const ctx = SRC.slice(counterIdx, counterIdx + 500);
    expect(ctx).not.toMatch(/將加入\s*\{dayLabel\}/);
    expect(ctx).not.toMatch(/個\s*·\s*將加入/);
  });

  it('dayLabel 仍可用於其他位置（page header 等）', () => {
    // deriveDayLabel helper 保留 — 不能因 counter 改而拔除
    expect(SRC).toMatch(/function deriveDayLabel/);
    // v2.31.99: dayLabel 改 hasDay 三元 — 仍 call deriveDayLabel 但加 fallback string
    expect(SRC).toMatch(/dayLabel\s*=[\s\S]{0,80}deriveDayLabel\(/);
  });
});
