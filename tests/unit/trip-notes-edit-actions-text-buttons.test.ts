// @vitest-environment node
/**
 * v2.34.42 prod audit fix: trip-notes 5 個 section 編輯模式 actions 從右側
 * 32px icon-only button 改 form 底下 .tp-btn 文字 button (完成 primary +
 * 刪除 destructive)。對齊 DESIGN.md L534「取消 ghost / 確認 destructive 實心」
 * + L1080+ .tp-btn family。
 *
 * Bug 取證：prod screenshot 顯示「✓ + 🗑」右側 32px icon 不明顯，user 反應
 * 看不到確定/取消。User 指示改 form 下方 2 文字 button 對齊 design 規範。
 *
 * Pure source-grep regression。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SECTIONS = [
  { name: 'Pretrip', file: 'PretripSection.tsx', class: 'tp-notes-pretrip-edit-actions', deleteTestid: /pretrip-delete-/, closeTestid: /pretrip-close-edit-/ },
  { name: 'Lodgings', file: 'LodgingsSection.tsx', class: 'tp-notes-lodging-edit-actions', deleteTestid: /lodging-delete-/, closeTestid: /lodging-close-edit-/ },
  { name: 'Reservations', file: 'ReservationsSection.tsx', class: 'tp-notes-reservation-edit-actions', deleteTestid: /reservation-delete-/, closeTestid: /reservation-close-edit-/ },
  { name: 'Emergency', file: 'EmergencySection.tsx', class: 'tp-notes-emergency-edit-actions', deleteTestid: /emergency-delete-/, closeTestid: /emergency-close-edit-/ },
  { name: 'Flights', file: 'FlightsSection.tsx', class: 'tp-notes-flight-edit-actions', deleteTestid: /flight-delete-/, closeTestid: /flight-close-edit-/ },
];

describe('v2.34.42 trip-notes 5 section 編輯模式 actions 改 .tp-btn 文字 button', () => {
  for (const sec of SECTIONS) {
    describe(`${sec.name}`, () => {
      const src = readFileSync(
        path.resolve(__dirname, `../../src/components/trip-notes/${sec.file}`),
        'utf8',
      );

      it('CSS 加 .${edit-actions} class (form 底下 footer)', () => {
        const cssClass = sec.class;
        // pattern: .tp-notes-*-edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
        const re = new RegExp(`\\.${cssClass.replace(/-/g, '-')}\\s*\\{[^}]*display:\\s*flex[^}]*justify-content:\\s*flex-end[^}]*\\}`, 's');
        expect(src).toMatch(re);
      });

      it('JSX 用 .tp-btn .tp-btn-primary (完成 button accent filled)', () => {
        expect(src).toMatch(/className="tp-btn tp-btn-primary"[^>]*data-testid=\{`/);
        expect(src).toMatch(/完成\s*<\/button>/);
      });

      it('JSX 用 .tp-btn .tp-btn-destructive (刪除 button red)', () => {
        expect(src).toMatch(/className="tp-btn tp-btn-destructive"[^>]*data-testid=\{`/);
        expect(src).toMatch(/刪除\s*<\/button>/);
      });

      it('既有 icon-only edit actions 不再 render Icon name="check" / "trash" (regression)', () => {
        // edit-mode block should NOT contain check/trash Icon inside actions
        // We grep that the .tp-btn variant exists and the old .icon-btn check button doesn't co-exist in edit mode
        // 簡單檢查：file 不再有 'tp-notes-*-icon-btn"[\s\S]{0,200}name="check"' 連續出現
        // 因為 read mode 仍有 edit/trash icon，我們驗 edit-actions class 周圍沒 Icon name="check"
        const editBlockMatch = src.match(/className="tp-notes-\w+-edit-actions"[\s\S]{0,1000}/);
        expect(editBlockMatch).not.toBeNull();
        const editBlock = editBlockMatch![0];
        expect(editBlock).not.toMatch(/Icon name="check"/);
      });
    });
  }

  it('css/tokens.css 仍提供 .tp-btn / .tp-btn-primary / .tp-btn-destructive (canonical button family)', () => {
    const tokens = readFileSync(
      path.resolve(__dirname, '../../css/tokens.css'),
      'utf8',
    );
    expect(tokens).toMatch(/\.tp-btn\s*\{/);
    expect(tokens).toMatch(/\.tp-btn-primary\s*\{/);
    expect(tokens).toMatch(/\.tp-btn-destructive\s*\{/);
  });
});
