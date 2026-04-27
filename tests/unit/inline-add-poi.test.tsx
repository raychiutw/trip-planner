/**
 * InlineAddPoi — V3 inline + 加景點（v2.11 Wave 2 wired with Nominatim）.
 *
 * 接 `/api/poi-search` Nominatim proxy，user 點 Add → POST entries 並
 * dispatch `tp-entry-updated`。「AI / 自訂」 chip 仍 route 到 /chat 保留 fallback。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InlineAddPoi from '../../src/components/trip/InlineAddPoi';

const SAMPLE_RESULTS = [
  { osm_id: 1001, name: '沖縄美ら海水族館', address: '沖縄県国頭郡本部町石川 424', lat: 26.6944, lng: 127.8779, category: 'tourism' },
  { osm_id: 1002, name: '古宇利大橋', address: '沖縄県国頭郡今帰仁村古宇利', lat: 26.6986, lng: 127.9886, category: 'highway' },
];

function renderInline(props: Partial<React.ComponentProps<typeof InlineAddPoi>> = {}) {
  return render(
    <MemoryRouter>
      <InlineAddPoi
        tripId="okinawa-2026"
        dayNum={1}
        {...props}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('InlineAddPoi — collapsed / expand', () => {
  it('renders collapsed call-to-action by default', () => {
    renderInline();
    const cta = screen.getByTestId('inline-add-poi-trigger');
    expect(cta.textContent).toContain('在 Day 1 加景點');
  });

  it('clicking trigger expands the form', () => {
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    expect(screen.getByTestId('inline-add-poi-form')).toBeTruthy();
  });

  it('close button collapses + clears state', () => {
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    fireEvent.click(screen.getByTestId('inline-add-poi-close'));
    expect(screen.queryByTestId('inline-add-poi-form')).toBeNull();
  });
});

describe('InlineAddPoi — chat fallback chips', () => {
  it('AI chip is a Link to /chat with prefilled prompt', () => {
    renderInline({ tripId: 'okinawa-2026', dayNum: 3 });
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    const aiChip = screen.getByTestId('inline-add-poi-chip-ai') as HTMLAnchorElement;
    expect(aiChip.getAttribute('href')).toContain('/chat');
    expect(aiChip.getAttribute('href')).toContain('tripId=okinawa-2026');
    expect(decodeURIComponent(aiChip.getAttribute('href') ?? '')).toContain('Day 3');
  });

  it('Custom chip is a Link to /chat with custom prompt', () => {
    renderInline({ tripId: 'okinawa-2026', dayNum: 2 });
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    const customChip = screen.getByTestId('inline-add-poi-chip-custom') as HTMLAnchorElement;
    expect(customChip.getAttribute('href')).toContain('/chat');
    expect(decodeURIComponent(customChip.getAttribute('href') ?? '')).toContain('Day 2');
  });
});

describe('InlineAddPoi — search wired to /api/poi-search', () => {
  it('search input enabled (not disabled like v2.9)', () => {
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    const input = screen.getByTestId('inline-add-poi-search') as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });

  it('typing < MIN_QUERY_LEN 2 chars does NOT fetch', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    fireEvent.change(screen.getByTestId('inline-add-poi-search'), { target: { value: '美' } });
    vi.advanceTimersByTime(300);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('typing ≥2 chars fires fetch after debounce (250ms)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: SAMPLE_RESULTS }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    fireEvent.change(screen.getByTestId('inline-add-poi-search'), { target: { value: '美ら海' } });
    expect(fetchMock).not.toHaveBeenCalled(); // not yet debounced
    vi.advanceTimersByTime(250);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0]![0];
    expect(url).toContain('/api/poi-search?q=');
    expect(decodeURIComponent(url as string)).toContain('美ら海');
  });

  it('debounce cancels previous timer when typing fast', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: SAMPLE_RESULTS }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    const input = screen.getByTestId('inline-add-poi-search');
    fireEvent.change(input, { target: { value: '美ら' } });
    vi.advanceTimersByTime(100);
    fireEvent.change(input, { target: { value: '美ら海水族' } });
    vi.advanceTimersByTime(100);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = fetchMock.mock.calls[0]![0];
    expect(decodeURIComponent(url as string)).toContain('美ら海水族');
  });

  it('renders results from API response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: SAMPLE_RESULTS }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    fireEvent.change(screen.getByTestId('inline-add-poi-search'), { target: { value: '沖繩' } });
    vi.advanceTimersByTime(250);
    await vi.waitFor(() => expect(screen.queryByTestId('inline-add-poi-results')).toBeTruthy());
    expect(screen.getByTestId('inline-add-poi-result-add-1001')).toBeTruthy();
    expect(screen.getByTestId('inline-add-poi-result-add-1002')).toBeTruthy();
    expect(screen.getByTestId('inline-add-poi-results').textContent).toContain('沖縄美ら海水族館');
  });

  it('empty results shows「沒找到」 hint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    fireEvent.change(screen.getByTestId('inline-add-poi-search'), { target: { value: 'xyz999' } });
    vi.advanceTimersByTime(250);
    await vi.waitFor(() => expect(screen.queryByTestId('inline-add-poi-results')).toBeTruthy());
    expect(screen.getByTestId('inline-add-poi-results').textContent).toContain('沒找到');
  });

  it('upstream error shows error hint in results panel', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 502 });
    vi.stubGlobal('fetch', fetchMock);
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    fireEvent.change(screen.getByTestId('inline-add-poi-search'), { target: { value: '東京' } });
    vi.advanceTimersByTime(250);
    await vi.waitFor(() => expect(screen.queryByTestId('inline-add-poi-results')).toBeTruthy());
    expect(screen.getByTestId('inline-add-poi-results').textContent).toMatch(/搜尋失敗|無法連線/);
  });
});

describe('InlineAddPoi — Add result wired to entries POST', () => {
  it('clicking Add → POST /api/trips/:id/days/:dayNum/entries with name + lat/lng', async () => {
    const searchResp = { ok: true, json: async () => ({ results: SAMPLE_RESULTS }) };
    const addResp = { ok: true, json: async () => ({ id: 99 }) };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(searchResp)
      .mockResolvedValueOnce(addResp);
    vi.stubGlobal('fetch', fetchMock);

    renderInline({ tripId: 'okinawa-2026', dayNum: 2 });
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    fireEvent.change(screen.getByTestId('inline-add-poi-search'), { target: { value: '美ら海' } });
    vi.advanceTimersByTime(250);
    await vi.waitFor(() => expect(screen.queryByTestId('inline-add-poi-result-add-1001')).toBeTruthy());

    fireEvent.click(screen.getByTestId('inline-add-poi-result-add-1001'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, opts] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/trips/okinawa-2026/days/2/entries');
    expect((opts as RequestInit).method).toBe('POST');
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.title).toBe('沖縄美ら海水族館');
    expect(body.lat).toBe(26.6944);
    expect(body.lng).toBe(127.8779);
    expect(body.poi_type).toBe('hotel'); // 'tourism' → mapNominatimCategory → 'hotel'
  });

  it('successful Add dispatches tp-entry-updated event', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: SAMPLE_RESULTS }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 99 }) });
    vi.stubGlobal('fetch', fetchMock);
    const listener = vi.fn();
    window.addEventListener('tp-entry-updated', listener);

    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    fireEvent.change(screen.getByTestId('inline-add-poi-search'), { target: { value: '美ら海' } });
    vi.advanceTimersByTime(250);
    await vi.waitFor(() => expect(screen.queryByTestId('inline-add-poi-result-add-1001')).toBeTruthy());
    fireEvent.click(screen.getByTestId('inline-add-poi-result-add-1001'));
    await vi.waitFor(() => expect(listener).toHaveBeenCalled());
    window.removeEventListener('tp-entry-updated', listener);
  });

  it('Add button shows「✓ 已加」 after success', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: SAMPLE_RESULTS }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 99 }) });
    vi.stubGlobal('fetch', fetchMock);

    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    fireEvent.change(screen.getByTestId('inline-add-poi-search'), { target: { value: '美ら海' } });
    vi.advanceTimersByTime(250);
    await vi.waitFor(() => expect(screen.queryByTestId('inline-add-poi-result-add-1001')).toBeTruthy());
    fireEvent.click(screen.getByTestId('inline-add-poi-result-add-1001'));
    await vi.waitFor(() => expect((screen.getByTestId('inline-add-poi-result-add-1001') as HTMLButtonElement).textContent).toContain('已加'));
  });

  it('Add fail shows error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: SAMPLE_RESULTS }) })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    fireEvent.change(screen.getByTestId('inline-add-poi-search'), { target: { value: '美ら海' } });
    vi.advanceTimersByTime(250);
    await vi.waitFor(() => expect(screen.queryByTestId('inline-add-poi-result-add-1001')).toBeTruthy());
    fireEvent.click(screen.getByTestId('inline-add-poi-result-add-1001'));
    await vi.waitFor(() => expect(screen.queryByTestId('inline-add-poi-error')).toBeTruthy());
  });
});
