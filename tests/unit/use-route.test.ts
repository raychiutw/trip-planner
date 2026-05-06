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
    global.fetch = vi.fn().mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useRoute(FROM, TO));
    // Wait long enough for any async resolution (null is the expected end state)
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toBeNull();
  });

  it('returns null on backend 502/503 (MAPS_UPSTREAM_FAILED / MAPS_LOCKED)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { code: 'MAPS_LOCKED' } }),
    } as unknown as Response);
    const { result } = renderHook(() => useRoute(FROM, TO));
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toBeNull();
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
