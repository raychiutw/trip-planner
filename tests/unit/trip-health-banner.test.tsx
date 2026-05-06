/**
 * TripHealthBanner contract tests — verify autoplan T4 fix invariants:
 *   - empty (closed=0 + missing=0) → return null（不渲染 stub）
 *   - closed=2 + missing=1 → desktop 顯示「此行程有 2 個地點已歇業 + 1 個查無資料，點擊查看」
 *   - compact=true → 顯示「3 個地點異常」+ truncate class
 *   - role="status" + aria-live="polite"
 *   - click → onIssueClick(first.poi_id)
 *   - Enter/Space keyboard 觸發
 *   - loading 期間 hidden
 *   - fetch error → hidden
 *   - refreshKey 改變 → 重 fetch
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TripHealthBanner from '../../src/components/trip/TripHealthBanner';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  // Force desktop default for non-compact tests
  vi.stubGlobal('matchMedia', vi.fn((q: string) => ({
    matches: false,  // compact disabled
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchOnce(body: unknown, ok = true) {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    json: async () => body,
  });
}

describe('TripHealthBanner', () => {
  it('empty (closed=0 + missing=0) → return null', async () => {
    mockFetchOnce({ version: 1, closed: 0, missing: 0, items: [] });
    const { container } = render(<TripHealthBanner tripId="t1" />);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    expect(container.querySelector('[data-testid="trip-health-banner"]')).toBeNull();
  });

  it('loading 期間 hidden', () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));
    const { container } = render(<TripHealthBanner tripId="t1" />);
    expect(container.querySelector('[data-testid="trip-health-banner"]')).toBeNull();
  });

  it('fetch error → hidden（不打擾）', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network down'));
    const { container } = render(<TripHealthBanner tripId="t1" />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="trip-health-banner"]')).toBeNull();
    });
  });

  it('closed=2 + missing=1 desktop full text', async () => {
    mockFetchOnce({
      version: 1, closed: 2, missing: 1,
      items: [
        { poi_id: 42, poi_name: 'POI-A', status: 'closed', reason: '永久歇業' },
        { poi_id: 43, poi_name: 'POI-B', status: 'closed', reason: null },
        { poi_id: 44, poi_name: 'POI-C', status: 'missing', reason: 'Google Maps 查無資料' },
      ],
    });
    render(<TripHealthBanner tripId="t1" />);
    const banner = await screen.findByTestId('trip-health-banner');
    expect(banner.textContent).toContain('此行程有 2 個地點已歇業 + 1 個查無資料，點擊查看');
    expect(banner.getAttribute('data-closed')).toBe('2');
    expect(banner.getAttribute('data-missing')).toBe('1');
  });

  it('compact=true → 單行 summary', async () => {
    mockFetchOnce({
      version: 1, closed: 2, missing: 1,
      items: [{ poi_id: 1, poi_name: 'X', status: 'closed', reason: null }],
    });
    render(<TripHealthBanner tripId="t1" compact />);
    const banner = await screen.findByTestId('trip-health-banner');
    expect(banner.textContent).toContain('3 個地點異常');
    expect(banner.querySelector('.tp-trip-health-banner-text-compact')).not.toBeNull();
  });

  it('role="status" + aria-live="polite"', async () => {
    mockFetchOnce({
      version: 1, closed: 1, missing: 0,
      items: [{ poi_id: 1, poi_name: 'X', status: 'closed', reason: null }],
    });
    render(<TripHealthBanner tripId="t1" />);
    const banner = await screen.findByTestId('trip-health-banner');
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.getAttribute('aria-live')).toBe('polite');
  });

  it('click → onIssueClick(first.poi_id)', async () => {
    mockFetchOnce({
      version: 1, closed: 1, missing: 0,
      items: [
        { poi_id: 99, poi_name: 'X', status: 'closed', reason: null },
        { poi_id: 100, poi_name: 'Y', status: 'closed', reason: null },
      ],
    });
    const onIssueClick = vi.fn();
    render(<TripHealthBanner tripId="t1" onIssueClick={onIssueClick} />);
    const banner = await screen.findByTestId('trip-health-banner');
    fireEvent.click(banner);
    expect(onIssueClick).toHaveBeenCalledWith(99);
  });

  it('Enter key → onIssueClick triggered', async () => {
    mockFetchOnce({
      version: 1, closed: 1, missing: 0,
      items: [{ poi_id: 7, poi_name: 'X', status: 'closed', reason: null }],
    });
    const onIssueClick = vi.fn();
    render(<TripHealthBanner tripId="t1" onIssueClick={onIssueClick} />);
    const banner = await screen.findByTestId('trip-health-banner');
    fireEvent.keyDown(banner, { key: 'Enter' });
    expect(onIssueClick).toHaveBeenCalledWith(7);
  });

  it('refreshKey 改變 → 重 fetch', async () => {
    mockFetchOnce({ version: 1, closed: 0, missing: 0, items: [] });
    const { rerender } = render(<TripHealthBanner tripId="t1" refreshKey={0} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    mockFetchOnce({ version: 1, closed: 0, missing: 0, items: [] });
    rerender(<TripHealthBanner tripId="t1" refreshKey={1} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
