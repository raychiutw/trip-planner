/**
 * trip-map-rail-dark.test.tsx — F001 TDD red test
 *
 * 驗證 TripMapRail 接受 dark prop 並將其傳遞給 useLeafletMap。
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/* ===== mock useMediaQuery — 永遠是 desktop ===== */
vi.mock('../../src/hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

/* ===== mock navigate ===== */
vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return { ...orig, useNavigate: () => vi.fn() };
});

/* ===== 捕捉 useLeafletMap 被呼叫時的 opts ===== */
const capturedOpts: Array<{ dark?: boolean }> = [];
const containerRefObj = { current: null as HTMLDivElement | null };

vi.mock('../../src/hooks/useLeafletMap', () => ({
  useLeafletMap: (opts: { dark?: boolean }) => {
    capturedOpts.push({ dark: opts?.dark });
    return {
      containerRef: containerRefObj,
      map: null,
      flyTo: vi.fn(),
      fitBounds: vi.fn(),
    };
  },
}));

const { default: TripMapRail } = await import('../../src/components/trip/TripMapRail');

const PINS = [
  { id: 1, type: 'entry' as const, index: 1, title: '首里城', lat: 26.217, lng: 127.719, sortOrder: 0 },
];

describe('F001 — TripMapRail dark prop', () => {
  it('當 dark={false} 時，useLeafletMap 收到 dark: false', () => {
    capturedOpts.length = 0;
    render(
      <MemoryRouter>
        <TripMapRail pins={PINS} tripId="test" dark={false} />
      </MemoryRouter>,
    );
    expect(capturedOpts.some((o) => o.dark === false)).toBe(true);
  });

  it('當 dark={true} 時，useLeafletMap 收到 dark: true', () => {
    capturedOpts.length = 0;
    render(
      <MemoryRouter>
        <TripMapRail pins={PINS} tripId="test" dark={true} />
      </MemoryRouter>,
    );
    expect(capturedOpts.some((o) => o.dark === true)).toBe(true);
  });
});
