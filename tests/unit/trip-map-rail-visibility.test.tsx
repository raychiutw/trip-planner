/**
 * trip-map-rail-visibility.test.tsx — TDD tests for Item 3:
 * TripMapRail renders only on ≥1024px (via useMediaQuery).
 *
 * Covers:
 * - <1024px: component renders null (display none approach)
 * - ≥1024px: component renders map container
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/* ===== mock useMediaQuery ===== */
const mockMediaQuery = vi.fn();

vi.mock('../../src/hooks/useMediaQuery', () => ({
  useMediaQuery: (query: string) => mockMediaQuery(query),
}));

/* ===== mock useLeafletMap ===== */
vi.mock('../../src/hooks/useLeafletMap', () => ({
  useLeafletMap: () => ({
    containerRef: { current: null },
    map: null,
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
  }),
}));

/* Lazy import after mock is set up */
const { default: TripMapRail } = await import('../../src/components/trip/TripMapRail');

beforeEach(() => {
  mockMediaQuery.mockReset();
});

const SAMPLE_PINS = [
  { id: 1, type: 'entry' as const, index: 1, title: 'Test', lat: 26.2, lng: 127.7, sortOrder: 0 },
];

function renderRail(pins = SAMPLE_PINS, tripId = 'test-trip') {
  return render(
    <MemoryRouter>
      <TripMapRail pins={pins} tripId={tripId} />
    </MemoryRouter>,
  );
}

describe('TripMapRail — visibility by breakpoint', () => {
  it('returns null when below 1024px', () => {
    mockMediaQuery.mockReturnValue(false); // not ≥1024px
    const { container } = renderRail();
    expect(container.firstChild).toBeNull();
  });

  it('renders map container when ≥1024px', () => {
    mockMediaQuery.mockReturnValue(true); // ≥1024px
    const { container } = renderRail();
    // Should render some element
    expect(container.firstChild).not.toBeNull();
  });

  it('renders with correct data-testid or class when ≥1024px', () => {
    mockMediaQuery.mockReturnValue(true);
    const { container } = renderRail();
    const rail = container.querySelector('.trip-map-rail');
    expect(rail).not.toBeNull();
  });
});
