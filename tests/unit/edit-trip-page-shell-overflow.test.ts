/**
 * v2.46.1 fix — EditTripPage 手機版橫向左右滑動 regression。
 *
 * Bug class（同 EditEntryPage v2.32.3 / TripNotesPage v2.34.50）：page shell 是
 * block / 隱式 auto grid track，被最寬子內容撐到 content max-content → page body
 * 比 viewport 寬 → app-shell-main overflow-x → 手機橫滑。
 *
 * Fix（root-cause，非 overflow:hidden 硬裁）：`.tp-edit-page-shell` 改 grid +
 * grid-template-columns: minmax(0, 1fr) 鎖 column 上限，子元素被約束到欄寬而非
 * 撐爆它。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(path.resolve(__dirname, '../../src/pages/EditTripPage.tsx'), 'utf8');

describe('EditTripPage — 手機 shell 橫向 overflow fix', () => {
  it('.tp-edit-page-shell 是 grid 且用 minmax(0, 1fr) 鎖 column 上限', () => {
    expect(SRC).toMatch(
      /\.tp-edit-page-shell\s*\{[\s\S]{0,400}display:\s*grid[\s\S]{0,200}grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
  });
});
