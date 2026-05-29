/**
 * v2.34.29 PR29 — trip-notes feature 全 token 化 source-grep regression
 *
 * 確保 6 個 trip-notes 檔案 (1 page + 5 section) 沒有 hardcoded font-size。
 * 全 DESIGN.md token，避免未來 drift。
 *
 * Reference: DESIGN.md token map
 * - --font-size-title2 (1.375rem / 22px) — flight number 大顯示
 * - --font-size-title3 (1.25rem / 20px) — empty hero title
 * - --font-size-headline (1.0625rem / 17px) — section title
 * - --font-size-subheadline (0.9375rem / 15px) — row title / input
 * - --font-size-footnote (0.875rem / 14px) — sub / button / placeholder
 * - --font-size-caption (0.75rem / 12px) — section meta（muted secondary）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const FILES = [
  'src/pages/TripNotesPage.tsx',
  'src/components/trip-notes/FlightsSection.tsx',
  'src/components/trip-notes/LodgingsSection.tsx',
  'src/components/trip-notes/ReservationsSection.tsx',
  'src/components/trip-notes/PretripSection.tsx',
  'src/components/trip-notes/EmergencySection.tsx',
];

describe('trip-notes feature — DESIGN.md token compliance (PR29)', () => {
  for (const rel of FILES) {
    it(`${rel} 零 hardcoded font-size px`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      const matches = src.match(/font-size:\s*\d+px/g) ?? [];
      expect(matches, `應為零，實際: ${matches.join(', ')}`).toEqual([]);
    });
  }

  it('TripNotesPage 用 --font-size-title3 + headline + caption + footnote 4 個 token', () => {
    const src = readFileSync(join(ROOT, 'src/pages/TripNotesPage.tsx'), 'utf8');
    expect(src).toMatch(/font-size:\s*var\(--font-size-title3\)/);
    expect(src).toMatch(/font-size:\s*var\(--font-size-headline\)/);
    expect(src).toMatch(/font-size:\s*var\(--font-size-caption\)/);
    expect(src).toMatch(/font-size:\s*var\(--font-size-footnote\)/);
  });

  it('FlightsSection 用 --font-size-title2 (flight number 大顯示)', () => {
    const src = readFileSync(join(ROOT, 'src/components/trip-notes/FlightsSection.tsx'), 'utf8');
    expect(src).toMatch(/font-size:\s*var\(--font-size-title2\)/);
  });

  // v2.34.x QA input-styling: edit-form inputs 改用 canonical .tp-input-long
  // (取代各 section 散落的 ad-hoc edit-grid input CSS)，font-size 不再硬掛
  // subheadline。改鎖「5 section text input 都走 canonical .tp-input-long」。
  it('5 section 都用 canonical .tp-input-long (text input/textarea)', () => {
    const sections = [
      'FlightsSection.tsx',
      'LodgingsSection.tsx',
      'ReservationsSection.tsx',
      'PretripSection.tsx',
      'EmergencySection.tsx',
    ];
    for (const f of sections) {
      const src = readFileSync(join(ROOT, 'src/components/trip-notes', f), 'utf8');
      expect(src, `${f} 應用 canonical .tp-input-long`).toMatch(/tp-input-long/);
    }
  });
});
