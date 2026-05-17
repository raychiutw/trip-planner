/**
 * v2.31.41 fix — desktop trip detail 缺右側 sticky map regression
 *
 * QA loop @ /trips?selected=... viewport 1440 截圖：right-col sticky map 完全
 * 不 render，timeline cards 右邊大量空白。CLAUDE.md「Desktop ≥1024px: 2-col
 * timeline + sticky map」spec breach.
 *
 * Root cause：v2.17.17 把 TripPage 改 embedded mode (noShell=true)，sheetContent
 * (TripSheet with map) 直接 throw away。host TripsListPage 自己的 AppShell
 * 也沒 pass sheet prop → desktop 3-pane 退化成 2-pane (sidebar + main)。
 *
 * Fix：
 *   - TripPage props 加 `setSheet?: (node: ReactNode | undefined) => void`
 *   - TripPage useEffect (noShell mode) 把 sheetContent 推給 host
 *   - TripsListPage useState 接 embeddedSheet，AppShell sheet={embeddedSheet}
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TRIP_PAGE_SRC = readFileSync(
  resolve(__dirname, '../../src/pages/TripPage.tsx'),
  'utf8',
);
const TRIPS_LIST_SRC = readFileSync(
  resolve(__dirname, '../../src/pages/TripsListPage.tsx'),
  'utf8',
);

describe('v2.31.41 TripPage exposes setSheet callback', () => {
  it('TripPageProps 含 setSheet prop', () => {
    expect(TRIP_PAGE_SRC).toMatch(
      /setSheet\?:\s*\(node:\s*ReactNode\s*\|\s*undefined\)\s*=>\s*void/,
    );
  });

  it('TripPageInner destructure setSheet', () => {
    expect(TRIP_PAGE_SRC).toMatch(/function TripPageInner\s*\([\s\S]*?setSheet[\s\S]*?\)/);
  });

  it('useEffect 在 noShell mode call setSheet(sheetContent)', () => {
    // Match useEffect 內含 noShell + setSheet + sheetContent
    expect(TRIP_PAGE_SRC).toMatch(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?noShell\s*&&\s*setSheet[\s\S]*?setSheet\(sheetContent\)[\s\S]*?\}/,
    );
  });

  it('cleanup 回 setSheet(undefined)', () => {
    expect(TRIP_PAGE_SRC).toMatch(/return\s*\(\)\s*=>\s*setSheet\(undefined\)/);
  });

  it('sheetContent 用 useMemo (穩定 identity 避免 host re-render 風暴)', () => {
    expect(TRIP_PAGE_SRC).toMatch(/const sheetContent\s*=\s*useMemo</);
  });
});

describe('v2.31.41 TripsListPage wires embedded sheet', () => {
  it('useState embeddedSheet', () => {
    expect(TRIPS_LIST_SRC).toMatch(
      /const\s*\[embeddedSheet,\s*setEmbeddedSheet\]\s*=\s*useState/,
    );
  });

  it('embedded TripPage 帶 setSheet prop', () => {
    expect(TRIPS_LIST_SRC).toMatch(
      /<TripPage[\s\S]*?setSheet=\{setEmbeddedSheet\}[\s\S]*?\/>/,
    );
  });

  it('AppShell 帶 sheet={embeddedSheet} prop', () => {
    expect(TRIPS_LIST_SRC).toMatch(/<AppShell[\s\S]*?sheet=\{embeddedSheet\}[\s\S]*?\/>/);
  });
});
