/**
 * trip-map-rail-singleton-style.test.tsx — F003 TDD red test
 *
 * 驗證：多個 <TripMapRail> render 後，DOM 中只有一個
 * <style data-scope="trip-map-rail"> 節點（不重複 inject）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/* ===== mock useMediaQuery — 固定為 desktop (≥1024px) ===== */
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

const { default: TripMapRail } = await import('../../src/components/trip/TripMapRail');

beforeEach(() => {
  mockMediaQuery.mockReturnValue(true); // ≥1024px desktop
  // 清除 singleton flag（重置 module state）
  // 由於 vitest 在同一 worker 中執行，需要手動清理 document head 中的 style
  document.head.querySelectorAll('[data-scope="trip-map-rail"]').forEach((el) => el.remove());
});

const SAMPLE_PINS = [
  { id: 1, type: 'entry' as const, index: 1, title: 'Test A', lat: 26.2, lng: 127.7, sortOrder: 0 },
];

function renderRail(tripId = 'test-trip') {
  return render(
    <MemoryRouter>
      <TripMapRail pins={SAMPLE_PINS} tripId={tripId} />
    </MemoryRouter>,
  );
}

describe('TripMapRail — singleton style injection (F003)', () => {
  it('render 1 個 TripMapRail 後，document.head 有 1 個 [data-scope="trip-map-rail"]', () => {
    renderRail('trip-a');
    const styles = document.head.querySelectorAll('[data-scope="trip-map-rail"]');
    expect(styles.length).toBe(1);
  });

  it('render 2 個 TripMapRail 後，document.head 仍只有 1 個 [data-scope="trip-map-rail"]', () => {
    // Render two separate TripMapRail instances
    renderRail('trip-a');
    renderRail('trip-b');
    const styles = document.head.querySelectorAll('[data-scope="trip-map-rail"]');
    expect(styles.length).toBe(1);
  });

  it('DOM 中不應有 <style> 直接嵌在 .trip-map-rail 元素內部', () => {
    const { container } = renderRail('trip-a');
    const inlineStyle = container.querySelector('.trip-map-rail > style');
    expect(inlineStyle).toBeNull();
  });
});
