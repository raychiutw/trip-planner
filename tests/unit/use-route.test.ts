/**
 * useRoute — cache + null-on-failure unit tests (post v2.23.0 google-maps-migration)
 *
 *  - Successful fetch → cache stored
 *  - Fetch failure → setResult(null) (no Haversine fallback per P11/T13)
 *  - cacheKey stable across coord precision noise
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { useRoute, __internal, type Coord } from '../../src/hooks/useRoute';

const FROM: Coord = { lat: 26.2124, lng: 127.6792 };
const TO: Coord = { lat: 26.6933, lng: 127.8773 };

describe('useRoute', () => {
  beforeEach(() => {
    indexedDB.deleteDatabase('trip-planner-routes');
    vi.restoreAllMocks();
  });

  it('cacheKey is stable across coord precision noise', () => {
    const k1 = __internal.cacheKey({ lat: 26.212400001, lng: 127.67919999 }, TO);
    const k2 = __internal.cacheKey(FROM, TO);
    expect(k1).toBe(k2);
  });

  it('returns null when enabled=false', async () => {
    const { result } = renderHook(() => useRoute(FROM, TO, { enabled: false }));
    expect(result.current).toBeNull();
  });

  it('returns null when from or to is null', async () => {
    const { result } = renderHook(() => useRoute(null, TO));
    expect(result.current).toBeNull();
  });

  it('returns null on fetch error (no Haversine fallback per P11/T13)', async () => {
    // v2.33.106 T-3: 用 waitFor 等 fetch promise reject + hook setState 完成，
    // 取代 setTimeout(50) — CI 慢機可能 race；正常 < 50ms 也可能比 hook 完成更慢。
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useRoute(FROM, TO));
    // 先等 fetch 被 call（hook effect 啟動）
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // 再等 result settle 到 null（rejection 處理完成）
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('returns null on backend 502/503 (MAPS_UPSTREAM_FAILED / MAPS_LOCKED)', async () => {
    // v2.33.106 T-3: 同上 — 用 waitFor 取代 setTimeout(50) race。
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { code: 'MAPS_LOCKED' } }),
    } as unknown as Response);
    global.fetch = fetchMock;
    const { result } = renderHook(() => useRoute(FROM, TO));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('returns polyline on successful fetch (Google Routes shape)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        polyline: [[26.1, 127.5], [26.5, 127.9]],
        duration: 1200,
        distance: 55000,
      }),
    } as unknown as Response);
    const { result } = renderHook(() => useRoute(FROM, TO));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.duration).toBe(1200);
    expect(result.current?.distance).toBe(55000);
    expect(result.current?.polyline).toHaveLength(2);
  });
});
