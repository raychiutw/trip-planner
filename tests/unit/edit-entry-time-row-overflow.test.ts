/**
 * v2.32.3 fix — EditEntryPage 時間 row 在 mobile (≤390px) overflow regression。
 *
 * Bug context：`<input type="time">` 在 mobile browser 有 intrinsic minimum
 * width (~130px) 含 「10:45 AM」label，兩個 card + arrow + gap 加總
 * scrollWidth 374px > viewport content area 347px → 「離開」card 被切。
 *
 * Fix：grid columns 改 minmax(0, 1fr) auto minmax(0, 1fr) + card / input
 * `min-width: 0` 放寬 flex/grid default min-content limit，允許 column
 * 縮到 intrinsic 以下。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EDIT_ENTRY_SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/EditEntryPage.tsx'),
  'utf8',
);

describe('EditEntryPage — 時間 row mobile overflow fix', () => {
  it('grid-template-columns 用 minmax(0, 1fr) 避免 min-content blow-out', () => {
    expect(EDIT_ENTRY_SRC).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/,
    );
  });

  it('.tp-edit-entry-time-card 含 min-width: 0 (放寬 flex default min-width auto)', () => {
    expect(EDIT_ENTRY_SRC).toMatch(
      /\.tp-edit-entry-time-card\s*\{[\s\S]{0,400}min-width:\s*0/,
    );
  });

  // v2.33.22: native <input type="time"> 換 TripTimePicker (button-based)，
  // `.tp-edit-entry-time-card input` 規則整 block 移除。overflow guard 已被
  // grid minmax(0, 1fr) + card min-width: 0 涵蓋；button trigger 自帶
  // overflow:hidden text-overflow:ellipsis on .tp-time-value (TripTimePicker.styles)。
  it('.tp-edit-entry-time-card label (TripTimePicker 觸發 button 內字段) 不會撐爆 grid', () => {
    // 確認 grid minmax 仍然防 blow-out (主防線)
    expect(EDIT_ENTRY_SRC).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    // 確認時間 card 自己仍是 min-width: 0
    expect(EDIT_ENTRY_SRC).toMatch(/\.tp-edit-entry-time-card\s*\{[\s\S]{0,400}min-width:\s*0/);
  });

  it('原本 hardcoded `grid-template-columns: 1fr auto 1fr` 已替換', () => {
    expect(EDIT_ENTRY_SRC).not.toMatch(/grid-template-columns:\s*1fr\s+auto\s+1fr/);
  });
});
