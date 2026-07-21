/**
 * PR1 — print route + 列印 menu repoint wiring (source grep).
 * Locks: the new /trip/:id/print route exists, and the TripsListPage 列印 menu
 * navigates to it (onPrint) instead of the old usePrintMode toggle.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const main = readFileSync(join(ROOT, 'src/entries/main.tsx'), 'utf8');
const list = readFileSync(join(ROOT, 'src/pages/TripsListPage.tsx'), 'utf8');
// v2.57.x: EmbeddedActionMenu 抽到 TripActionsMenu.tsx（供 TripStackLayout 共用）。
const menu = readFileSync(join(ROOT, 'src/components/trip/TripActionsMenu.tsx'), 'utf8');

describe('trip print route + menu wiring', () => {
  it('registers the print route under /trip/:tripId', () => {
    expect(main).toMatch(/path="print"\s+element=\{<TripPrintPage\s*\/>\}/);
    expect(main).toMatch(/const TripPrintPage = lazyWithRetry\(/);
  });

  it('TripActionsMenu accepts onPrint and the 列印 button uses it (fallback to togglePrint)', () => {
    expect(menu).toMatch(/onPrint\?: \(\) => void/);
    expect(menu).toMatch(/onPrint \? onPrint\(\) : tripPageRef\.current\?\.togglePrint\(\)/);
  });

  it('call site navigates the 列印 menu to /print', () => {
    expect(list).toMatch(/onPrint=\{\(\) => navigate\(`\/trip\/\$\{encodeURIComponent\(effectiveSelectedId\)\}\/print`\)\}/);
  });
});
