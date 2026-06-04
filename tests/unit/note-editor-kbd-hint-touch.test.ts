// @vitest-environment node
/**
 * 備註 inline 編輯器的鍵盤捷徑提示（⌘ + ↩ 完成 · esc 關閉）只在有實體鍵盤的裝置
 * 顯示。觸控裝置（手機 / 平板）沒有 ⌘ / esc 鍵 → 提示無意義且誤導使用者，須隱藏。
 *
 * 兩處同源 inline note editor 都有相同 kbd 提示，須一起修：
 *   - EditEntryPage PerPoiNoteRow（.tp-poi-note-kbd）
 *   - TimelineRail inline note edit（.tp-rail-note-kbd）
 *
 * 判斷觸控用 `@media (hover: none) and (pointer: coarse)`（無 hover + 粗指標 = 觸控），
 * 比 max-width 斷點精準（觸控筆電仍可有鍵盤，但手機/平板兩條件同時成立）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (rel: string) => readFileSync(path.resolve(__dirname, '../../', rel), 'utf8');
const EDIT_ENTRY = read('src/pages/EditEntryPage.tsx');
const TIMELINE_RAIL = read('src/components/trip/TimelineRail.tsx');

const touchHides = (cls: string) =>
  new RegExp(
    `@media \\(hover: none\\) and \\(pointer: coarse\\)\\s*\\{[\\s\\S]*?\\.${cls}\\s*\\{[^}]*display:\\s*none`,
  );

describe('inline note editor — 鍵盤捷徑提示在觸控裝置隱藏', () => {
  it('EditEntryPage 在 touch 裝置隱藏 .tp-poi-note-kbd', () => {
    expect(EDIT_ENTRY).toMatch(touchHides('tp-poi-note-kbd'));
  });

  it('TimelineRail 在 touch 裝置隱藏 .tp-rail-note-kbd', () => {
    expect(TIMELINE_RAIL).toMatch(touchHides('tp-rail-note-kbd'));
  });
});
