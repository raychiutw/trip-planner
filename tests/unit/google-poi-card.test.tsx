/**
 * GooglePoiCard — TDD red test.
 *
 * owner 2026-07-21「地圖點選 Google POI」，對齊 Flutter GooglePoiAccessoryCard
 * (google_poi_accessory_card.dart)：地圖上點到的 Google 原生 POI（非我們自己的
 * 行程 pin）在底部卡片顯示 — 圖示 + 店名 + 關閉(X) + 「在 Google 地圖開啟」。
 *
 * web 特有落差：Google Maps JS API 的 IconMouseEvent 只給 placeId + 座標，沒有
 * 店名（Flutter 原生 SDK 免費附帶）。名稱要另打既有 GET /api/places/resolve。
 * loading 中顯示「載入地點名稱…」；resolve 失敗 fallback「Google 地圖地點」
 * （對齊 Flutter selection.name 空字串時的同一句 fallback）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

import GooglePoiCard from '../../src/components/trip/GooglePoiCard';

const POI = { placeId: 'ChIJ-okinawa-1', lat: 26.2, lng: 127.6 };

describe('GooglePoiCard', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('shows a loading placeholder before /places/resolve returns', () => {
    apiFetchMock.mockReturnValue(new Promise(() => {})); // never resolves
    render(<GooglePoiCard poi={POI} onClose={vi.fn()} />);
    expect(screen.getByText('載入地點名稱…')).toBeInTheDocument();
  });

  it('calls /places/resolve with the tapped placeId', () => {
    apiFetchMock.mockReturnValue(new Promise(() => {}));
    render(<GooglePoiCard poi={POI} onClose={vi.fn()} />);
    expect(apiFetchMock.mock.calls[0]![0]).toContain('/places/resolve?placeId=ChIJ-okinawa-1');
  });

  it('renders the resolved name once /places/resolve returns', async () => {
    apiFetchMock.mockResolvedValue({ placeId: POI.placeId, lat: POI.lat, lng: POI.lng, name: '奧武山公園', address: null, hours: null, priceLevel: null });
    render(<GooglePoiCard poi={POI} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('奧武山公園')).toBeInTheDocument());
  });

  it('falls back to "Google 地圖地點" when resolve fails (404 delisted / rate limited)', async () => {
    apiFetchMock.mockRejectedValue(new Error('DATA_NOT_FOUND'));
    render(<GooglePoiCard poi={POI} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Google 地圖地點')).toBeInTheDocument());
  });

  it('close button calls onClose', async () => {
    apiFetchMock.mockResolvedValue({ name: 'X' });
    const onClose = vi.fn();
    render(<GooglePoiCard poi={POI} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /關閉/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"在 Google 地圖開啟" opens a new tab to the Google Maps search URL with query_place_id', async () => {
    apiFetchMock.mockResolvedValue({ name: '奧武山公園' });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<GooglePoiCard poi={POI} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('奧武山公園')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /在 Google 地圖開啟/ }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0]!;
    expect(String(url)).toContain('https://www.google.com/maps/search/');
    expect(String(url)).toContain('query_place_id=ChIJ-okinawa-1');
    expect(target).toBe('_blank');
    expect(String(features)).toContain('noopener');
    openSpy.mockRestore();
  });

  it('re-fetches when poi.placeId changes (new POI tapped while card still open)', async () => {
    apiFetchMock.mockResolvedValue({ name: 'A' });
    const { rerender } = render(<GooglePoiCard poi={POI} onClose={vi.fn()} />);
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    apiFetchMock.mockResolvedValue({ name: 'B' });
    rerender(<GooglePoiCard poi={{ placeId: 'ChIJ-other', lat: 1, lng: 2 }} onClose={vi.fn()} />);
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
    expect(apiFetchMock.mock.calls[1]![0]).toContain('placeId=ChIJ-other');
  });
});
