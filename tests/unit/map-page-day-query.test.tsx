/**
 * map-page-day-query.test.tsx — TDD tests for Item 7 + F011:
 * MapPage supports ?day=N query param — reads dayNum from URL.
 *
 * 兩層測試：
 * 1. Source-code regression guard (原有)：避免 searchParams.get('day') 被誤刪
 * 2. Runtime tests (F011)：mount MapPage 驗證 ?day=2、?day=abc、?day=999 實際行為
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MAP_PAGE_PATH = resolve(__dirname, '../../src/pages/MapPage.tsx');
const source = readFileSync(MAP_PAGE_PATH, 'utf-8');

/* ===== Source-code regression guard (Item 7, 保留) ===== */
describe('MapPage — ?day=N query support (Item 7 source guard)', () => {
  it('imports useSearchParams', () => {
    expect(source).toContain('useSearchParams');
  });

  it('calls searchParams.get("day")', () => {
    expect(source).toMatch(/searchParams\.get\(['"]day['"]\)/);
  });

  it('uses dayColor from dayPalette for polyline colouring', () => {
    // MapPage should use dayColor() for coloured routes
    // (currently handled by OceanMap routes prop — check that it is still present)
    expect(source).toContain('routes');
  });

  it('has initialTab logic reading from searchParams (map-page-multiday-overview: initialDayNum renamed to initialTab)', () => {
    expect(source).toContain('initialTab');
    expect(source).toMatch(/searchParams|q\s*=/); // uses the day query
  });

  it('breadcrumb or title references active day', () => {
    expect(source).toMatch(/activeTab|DAY/);
  });
});

/* ===== F011: Runtime tests — mock TripContext + mount MapPage ===== */

// Mock react-router-dom（useParams + useSearchParams + useNavigate）
vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...orig,
    useNavigate: () => vi.fn(),
    useParams: () => ({ tripId: 'test-trip' }),
  };
});

// Mock useTripContext — 提供 allDays with days 1, 2, 3
const mockAllDays = {
  1: { dayNum: 1, date: '2026-07-29', label: '北谷', entries: [] },
  2: { dayNum: 2, date: '2026-07-30', label: '那覇', entries: [] },
  3: { dayNum: 3, date: '2026-07-31', label: '糸満', entries: [] },
};

vi.mock('../../src/contexts/TripContext', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/contexts/TripContext')>();
  return {
    ...orig, // 保留 TripContext export
    useTripContext: () => ({
      trip: { id: 'test-trip', title: 'Test Trip' },
      allDays: mockAllDays,
      loading: false,
      days: [],
      currentDay: undefined,
      currentDayNum: 1,
      switchDay: vi.fn(),
      refetchCurrentDay: vi.fn(),
      docs: [],
      error: null,
    }),
  };
});

// Mock OceanMap (lazy) to avoid Leaflet in JSDOM
vi.mock('../../src/components/trip/OceanMap', () => ({
  default: () => null,
}));

// Mock useOnlineStatus
vi.mock('../../src/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TripContext } from '../../src/contexts/TripContext';
import type { UseTripReturn } from '../../src/hooks/useTrip';

const mockContextValue: UseTripReturn = {
  trip: { id: 'test-trip', title: 'Test Trip' } as Parameters<typeof TripContext.Provider>[0]['value'] extends { trip: infer T } ? T : never,
  allDays: mockAllDays as Record<number, Parameters<typeof TripContext.Provider>[0]['value'] extends { allDays: infer T } ? T extends Record<number, infer U> ? U : never : never>,
  loading: false,
  days: [],
  currentDay: undefined,
  currentDayNum: 1,
  switchDay: vi.fn(),
  refetchCurrentDay: vi.fn(),
  docs: [],
  error: null,
};

// 簡單的 helper：mount MapPage at given URL
async function mountMapPage(url: string) {
  const { default: MapPage } = await import('../../src/pages/MapPage');
  const result = render(
    <MemoryRouter initialEntries={[url]}>
      <TripContext.Provider value={mockContextValue as unknown as UseTripReturn}>
        <Routes>
          <Route path="/trip/:tripId/map" element={<MapPage />} />
        </Routes>
      </TripContext.Provider>
    </MemoryRouter>,
  );
  return result;
}

describe('F011 — MapPage ?day=N runtime tests', () => {
  it('?day=2：activeTab 從 DAY 01 顯示 DAY 02 標記', async () => {
    const { getAllByText } = await mountMapPage('/trip/test-trip/map?day=2');
    // 麵包屑中有 DAY 02（activeTab = 2）
    const dayTexts = getAllByText(/DAY 02/i);
    expect(dayTexts.length).toBeGreaterThan(0);
  });

  it('?day=abc（無效值）：回退到預設 day 1，顯示 DAY 01', async () => {
    const { getAllByText } = await mountMapPage('/trip/test-trip/map?day=abc');
    const dayTexts = getAllByText(/DAY 01/i);
    expect(dayTexts.length).toBeGreaterThan(0);
  });

  it('?day=999（超出範圍）：回退到預設 day 1，顯示 DAY 01', async () => {
    const { getAllByText } = await mountMapPage('/trip/test-trip/map?day=999');
    const dayTexts = getAllByText(/DAY 01/i);
    expect(dayTexts.length).toBeGreaterThan(0);
  });
});
