/**
 * EditEntryPage alt-row mobile layout — v2.33.138 PR13
 *
 * QA 2026-05-28：mobile (390px) 備選 row 內 alt-extra-chip.hours 含整週營業
 * 時段，被 4 個 actions button (44px each ≈ 200px) 擠壓 meta 到 ~120px，
 * 文字斷成單字垂直堆疊，視覺像 textarea。Fix: ≤640px wrap，actions 換到
 * 下一行 align right，meta 取近全寬。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '../../src/pages/EditEntryPage.tsx'),
  'utf8',
);

describe('alt-row mobile responsive layout', () => {
  it('@media max-width: 640px breakpoint 存在', () => {
    expect(SRC).toMatch(/@media \(max-width: 640px\) \{[\s\S]*tp-edit-entry-alt-row/);
  });

  it('mobile alt-row flex-wrap + align-items flex-start (action drops below)', () => {
    expect(SRC).toMatch(/@media \(max-width: 640px\)[\s\S]*tp-edit-entry-alt-row \{[\s\S]*flex-wrap: wrap[\s\S]*align-items: flex-start/);
  });

  it('mobile meta flex-basis ~ 100% (扣掉 order 28px) → 取近全寬', () => {
    expect(SRC).toMatch(/tp-edit-entry-alt-meta \{\s+flex-basis: calc\(100% - 28px\)/);
  });

  it('mobile actions flex-basis 100% + justify-content flex-end + margin-top', () => {
    expect(SRC).toMatch(/tp-edit-entry-alt-actions \{\s+flex-basis: 100%;\s+justify-content: flex-end;\s+margin-top: 4px/);
  });

  it('comment 解釋 root cause (4 button × 44px 擠 meta + hours chip 整週)', () => {
    expect(SRC).toMatch(/v2\.33\.138 mobile fix/);
    expect(SRC).toMatch(/4 button.*44px each/);
    expect(SRC).toMatch(/alt-extra-chip\.hours/);
  });
});

describe('desktop layout 未影響', () => {
  it('media query 之外 .tp-edit-entry-alt-row 仍 display:flex (row direction default)', () => {
    // 取 base rule（first occurrence）— 應仍是 flex + align-items:center
    const baseRule = SRC.match(/\.tp-edit-entry-alt-row \{[\s\S]*?\}/);
    expect(baseRule).toBeTruthy();
    expect(baseRule![0]).toMatch(/display: flex/);
    expect(baseRule![0]).toMatch(/align-items: center/);
  });

  it('alt-actions base 維持 flex-shrink: 0 (desktop 不變)', () => {
    expect(SRC).toMatch(/\.tp-edit-entry-alt-actions \{ display: flex; gap: 4px; flex-shrink: 0; \}/);
  });
});
