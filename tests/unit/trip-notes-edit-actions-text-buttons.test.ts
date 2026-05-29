// @vitest-environment node
/**
 * v2.34.42 prod audit fix → v2.34.46 PR46 updated
 *
 * trip-notes 5 個 section 編輯模式 actions：v2.34.42 改 form 底下 .tp-btn 文字
 * button（完成 primary + 刪除 destructive）。v2.34.46 PR46 user feedback「保留
 * autosave 按鈕只保留刪除」→ 拔「完成」button，只保留刪除。
 *
 * Pure source-grep regression。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SECTIONS = [
  { name: 'Pretrip', file: 'PretripSection.tsx', class: 'tp-notes-pretrip-edit-actions' },
  { name: 'Lodgings', file: 'LodgingsSection.tsx', class: 'tp-notes-lodging-edit-actions' },
  { name: 'Reservations', file: 'ReservationsSection.tsx', class: 'tp-notes-reservation-edit-actions' },
  { name: 'Emergency', file: 'EmergencySection.tsx', class: 'tp-notes-emergency-edit-actions' },
  { name: 'Flights', file: 'FlightsSection.tsx', class: 'tp-notes-flight-edit-actions' },
];

describe('v2.34.46 trip-notes 5 section 編輯模式 actions 只剩刪除 button', () => {
  for (const sec of SECTIONS) {
    describe(`${sec.name}`, () => {
      const src = readFileSync(
        path.resolve(__dirname, `../../src/components/trip-notes/${sec.file}`),
        'utf8',
      );

      it(`CSS 有 .${sec.class} (form 底下 footer)`, () => {
        const re = new RegExp(`\\.${sec.class}\\s*\\{[^}]*display:\\s*flex[^}]*justify-content:\\s*flex-end[^}]*\\}`, 's');
        expect(src).toMatch(re);
      });

      it('JSX 有 .tp-btn .tp-btn-destructive (刪除 button red)', () => {
        expect(src).toMatch(/className="tp-btn tp-btn-destructive"[^>]*data-testid=\{`/);
        expect(src).toMatch(/刪除\s*<\/button>/);
      });

      it('v2.34.46: 「完成」button 已移除 — 不再 render tp-btn-primary 在 edit-actions', () => {
        const editBlockMatch = src.match(/className="tp-notes-\w+-edit-actions"[\s\S]{0,500}/);
        expect(editBlockMatch).not.toBeNull();
        const editBlock = editBlockMatch![0];
        expect(editBlock).not.toMatch(/tp-btn-primary/);
        expect(editBlock).not.toMatch(/完成\s*<\/button>/);
        expect(editBlock).not.toMatch(/close-edit-/);
      });
    });
  }

  it('css/tokens.css 仍提供 .tp-btn / .tp-btn-destructive (canonical button family)', () => {
    const tokens = readFileSync(
      path.resolve(__dirname, '../../css/tokens.css'),
      'utf8',
    );
    expect(tokens).toMatch(/\.tp-btn\s*\{/);
    expect(tokens).toMatch(/\.tp-btn-destructive\s*\{/);
  });
});
