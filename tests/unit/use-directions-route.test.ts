/**
 * Unit tests for useDirectionsRoute hook
 *
 * 測試：
 *   1. enabled=false → null path, not loading
 *   2. pins < 2 → null path
 *   3. API 成功 → routePath + legMidpoints
 *   4. API 失敗 → null path
 *   5. routes library 載入失敗 → null path
 *   6. cache hit → 不重複呼叫 API
 *   7. buildCacheKey 純函式
 */

import { renderHook, waitFor } from '@testing-library/react';

/* ===== Mock @googlemaps/js-api-loader ===== */

const mockImportLibrary = vi.fn().mockResolvedValue(undefined);
vi.mock('@googlemaps/js-api-loader', () => ({
  importLibrary: (...args: unknown[]) => mockImportLibrary(...args),
}));

/* ===== Mock google.maps ===== */

const mockRoute = vi.fn();

beforeEach(() => {
  // @ts-expect-error — 模擬 global google.maps
  globalThis.google = {
    maps: {
      DirectionsService: vi.fn(function () {
        return { route: mockRoute };
      }),
      TravelMode: { DRIVING: 'DRIVING', WALKING: 'WALKING', TRANSIT: 'TRANSIT' },
      DirectionsStatus: { OK: 'OK' },
      LatLng: vi.fn(function (lat: number, lng: number) { return { lat: () => lat, lng: () => lng }; }),
    },
  };
  mockImportLibrary.mockResolvedValue(undefined);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ===== 動態 import（避免 google.maps 未初始化）===== */

async function getHookAndUtils() {
  const mod = await import('../../src/hooks/useDirectionsRoute');
  return {
    useDirectionsRoute: mod.useDirectionsRoute,
    buildCacheKey: mod.buildCacheKey,
  };
}

/* ===== 測試資料 ===== */

const makePins = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    type: 'entry' as const,
    index: i + 1,
    title: `P${i + 1}`,
    lat: 26.2 + i * 0.01,
    lng: 127.7 + i * 0.01,
    sortOrder: i + 1,
  }));

/** 模擬 DirectionsResult：每個 leg 有 3 個 step points */
function makeDirectionsResult(legCount: number) {
  return {
    routes: [{
      legs: Array.from({ length: legCount }, (_, i) => ({
        steps: [{
          path: [
            { lat: () => 26.2 + i * 0.01, lng: () => 127.7 + i * 0.01 },
            { lat: () => 26.205 + i * 0.01, lng: () => 127.705 + i * 0.01 },
            { lat: () => 26.21 + i * 0.01, lng: () => 127.71 + i * 0.01 },
          ],
        }],
      })),
    }],
  };
}

/* ===== Tests ===== */

describe('useDirectionsRoute — 基本行為', () => {
  it('1. enabled=false → null path, not loading', async () => {
    const { useDirectionsRoute } = await getHookAndUtils();
    const pins = makePins(3);
    const { result } = renderHook(() => useDirectionsRoute(pins, false));

    expect(result.current.routePath).toBeNull();
    expect(result.current.legMidpoints).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockRoute).not.toHaveBeenCalled();
  });

  it('2. pins < 2 → null path', async () => {
    const { useDirectionsRoute } = await getHookAndUtils();
    const pins = makePins(1);
    const { result } = renderHook(() => useDirectionsRoute(pins, true));

    expect(result.current.routePath).toBeNull();
    expect(mockRoute).not.toHaveBeenCalled();
  });
});

describe('useDirectionsRoute — API 呼叫', () => {
  it('3. API 成功 → routePath + legMidpoints', async () => {
    mockRoute.mockResolvedValue(makeDirectionsResult(1));

    const { useDirectionsRoute } = await getHookAndUtils();
    const pins = makePins(2);
    const { result } = renderHook(() => useDirectionsRoute(pins, true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.routePath).not.toBeNull();
    expect(result.current.routePath).toHaveLength(3);
    expect(result.current.legMidpoints).toHaveLength(1);
    expect(mockImportLibrary).toHaveBeenCalledWith('routes');
  });

  it('4. API 失敗 → null path', async () => {
    mockRoute.mockRejectedValue(new Error('ZERO_RESULTS'));

    const { useDirectionsRoute } = await getHookAndUtils();
    const pins = makePins(2);
    const { result } = renderHook(() => useDirectionsRoute(pins, true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.routePath).toBeNull();
    expect(result.current.legMidpoints).toEqual([]);
  });

  it('5. routes library 載入失敗 → null path', async () => {
    mockImportLibrary.mockRejectedValue(new Error('Library load failed'));

    const { useDirectionsRoute } = await getHookAndUtils();
    const pins = makePins(2);
    const { result } = renderHook(() => useDirectionsRoute(pins, true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.routePath).toBeNull();
    expect(mockRoute).not.toHaveBeenCalled();
  });

  it('6. 多 leg → 每 leg 一個 midpoint', async () => {
    mockRoute.mockResolvedValue(makeDirectionsResult(3));

    const { useDirectionsRoute } = await getHookAndUtils();
    const pins = makePins(4);
    const { result } = renderHook(() => useDirectionsRoute(pins, true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.routePath).toHaveLength(9);
    expect(result.current.legMidpoints).toHaveLength(3);
  });
});

describe('useDirectionsRoute — 快取', () => {
  it('7. 相同 pins 再次 render → 使用快取，不重複呼叫 API', async () => {
    mockRoute.mockResolvedValue(makeDirectionsResult(1));

    const { useDirectionsRoute } = await getHookAndUtils();
    const pins = makePins(2);
    const { result, rerender } = renderHook(
      ({ p, e }) => useDirectionsRoute(p, e),
      { initialProps: { p: pins, e: true } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockRoute).toHaveBeenCalledTimes(1);
    const firstPath = result.current.routePath;

    rerender({ p: pins, e: true });

    expect(mockRoute).toHaveBeenCalledTimes(1);
    expect(result.current.routePath).toEqual(firstPath);
  });
});

describe('buildCacheKey — 純函式', () => {
  it('8. 相同座標不同順序 → 相同 key（依 sortOrder 排序）', async () => {
    const { buildCacheKey } = await getHookAndUtils();
    const pins1 = [
      { id: 1, type: 'entry' as const, index: 1, title: 'A', lat: 26.2, lng: 127.7, sortOrder: 1 },
      { id: 2, type: 'entry' as const, index: 2, title: 'B', lat: 26.21, lng: 127.71, sortOrder: 2 },
    ];
    const pins2 = [pins1[1], pins1[0]]; // 反序

    expect(buildCacheKey(pins1)).toBe(buildCacheKey(pins2));
  });

  it('9. 不同座標 → 不同 key', async () => {
    const { buildCacheKey } = await getHookAndUtils();
    const pins1 = makePins(2);
    const pins2 = makePins(3);

    expect(buildCacheKey(pins1)).not.toBe(buildCacheKey(pins2));
  });
});
