/**
 * Unit tests for MapRoute component (F004 + F005)
 *
 * F004 測試：
 *   1. 0/1 個 pin → 不建立 Polyline
 *   2. 2+ 個 pins → 建立 Polyline，樣式正確（strokeWeight=2, strokeOpacity=0.7）
 *   3. 依 sort_order 升序排列 path
 *   4. 飯店（sortOrder=-1）排在最前
 *   5. pins 增加 → 呼叫 setPath 更新路徑而非重建
 *   6. unmount → setMap(null) 清除 Polyline
 *   7. getComputedStyle 空值 → fallback #007AFF
 *   8. getComputedStyle 有值 → 使用該值
 *
 * F005 測試：
 *   12. buildTravelSegments — travelMin > 0 → 正確中點計算
 *   13. buildTravelSegments — 無 travelMin → 不產生 segment
 *   14. buildTravelSegments — 依 sort_order 排序後計算正確中點
 *   15. getTravelEmoji — walk → 🚶
 *   16. getTravelEmoji — train → 🚆
 *   17. getTravelEmoji — 預設 → 🚗
 *   18. MapRoute：有 travelMin pins → 建立 OverlayView（setMap 被呼叫）
 *   19. MapRoute：無 travelMin pins → 不建立 OverlayView
 *   20. MapRoute unmount → OverlayView setMap(null) 清除
 */

import React from 'react';
import { render } from '@testing-library/react';

/* ===== Mock google.maps.Polyline + OverlayView（必須在 vi.mock 之前以 vi.hoisted 宣告）===== */

const { mockSetPath, mockSetMap, mockPolyline, mockOverlaySetMap, MockOverlayView } = vi.hoisted(() => {
  const mockSetPath = vi.fn();
  const mockSetMap = vi.fn();
  const mockPolyline = vi.fn(function() {
    return {
      setPath: mockSetPath,
      setMap: mockSetMap,
    };
  });

  // OverlayView mock：記錄每次 setMap 呼叫
  const mockOverlaySetMap = vi.fn();
  class MockOverlayView {
    setMap = mockOverlaySetMap;
    // 子類別需要 override 這些，但 mock 不需要執行
    onAdd() {}
    draw() {}
    onRemove() {}
    getPanes() { return null; }
    getProjection() { return null; }
  }

  return { mockSetPath, mockSetMap, mockPolyline, mockOverlaySetMap, MockOverlayView };
});

/* ===== 測試資料 ===== */

const makePins = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    type: 'entry' as const,
    index: i + 1,
    title: `景點 ${i + 1}`,
    lat: 26.2 + i * 0.01,
    lng: 127.7 + i * 0.01,
    sortOrder: i + 1,
  }));

const HOTEL_PIN = {
  id: 100,
  type: 'hotel' as const,
  index: 0,
  title: '那霸飯店',
  lat: 26.19,
  lng: 127.68,
  sortOrder: -1,
};

const mockMap = {} as google.maps.Map;

/** Directions API 路線模擬 */
const makeRoutePath = (count: number): google.maps.LatLngLiteral[] =>
  Array.from({ length: count }, (_, i) => ({
    lat: 26.2 + i * 0.005,
    lng: 127.7 + i * 0.005,
  }));

const makeLegMidpoints = (count: number): google.maps.LatLngLiteral[] =>
  Array.from({ length: count }, (_, i) => ({
    lat: 26.205 + i * 0.01,
    lng: 127.705 + i * 0.01,
  }));

/* ===== Setup ===== */

beforeEach(() => {
  // @ts-expect-error — 模擬 global google.maps
  globalThis.google = {
    maps: {
      Polyline: mockPolyline,
      OverlayView: MockOverlayView,
      LatLng: vi.fn((lat: number, lng: number) => ({ lat, lng })),
    },
  };
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ===== 動態 import MapRoute ===== */

async function getMapRoute() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import('../../src/components/trip/MapRoute') as any;
  return mod.MapRoute;
}

/* ===== Tests ===== */

describe('MapRoute — Polyline 建立', () => {
  it('1. 無 routePath → 不建立 Polyline', async () => {
    const MapRoute = await getMapRoute();
    render(<MapRoute map={mockMap} pins={[]} />);

    expect(mockPolyline).not.toHaveBeenCalled();
  });

  it('2. routePath 點數不足 → 不建立 Polyline', async () => {
    const MapRoute = await getMapRoute();
    render(<MapRoute map={mockMap} pins={makePins(1)} routePath={makeRoutePath(1)} />);

    expect(mockPolyline).not.toHaveBeenCalled();
  });

  it('2b. routeLoading=true → 不建立 Polyline', async () => {
    const MapRoute = await getMapRoute();
    render(<MapRoute map={mockMap} pins={makePins(2)} routePath={makeRoutePath(5)} routeLoading={true} />);

    expect(mockPolyline).not.toHaveBeenCalled();
  });

  it('3. routePath 提供 → 建立 Polyline', async () => {
    const MapRoute = await getMapRoute();
    render(<MapRoute map={mockMap} pins={makePins(2)} routePath={makeRoutePath(5)} />);

    expect(mockPolyline).toHaveBeenCalledTimes(1);
  });

  it('4. Polyline 樣式：strokeWeight=2, strokeOpacity=0.7, geodesic=false', async () => {
    const MapRoute = await getMapRoute();
    render(<MapRoute map={mockMap} pins={makePins(3)} routePath={makeRoutePath(5)} />);

    expect(mockPolyline).toHaveBeenCalledWith(
      expect.objectContaining({
        strokeWeight: 2,
        strokeOpacity: 0.7,
        geodesic: false,
        map: mockMap,
      }),
    );
  });
});

describe('MapRoute — routePath 使用', () => {
  it('5. routePath 直接作為 Polyline path', async () => {
    const routePath = [
      { lat: 26.22, lng: 127.72 },
      { lat: 26.20, lng: 127.70 },
      { lat: 26.21, lng: 127.71 },
    ];

    const MapRoute = await getMapRoute();
    render(<MapRoute map={mockMap} pins={makePins(2)} routePath={routePath} />);

    const callArg = mockPolyline.mock.calls[0][0];
    expect(callArg.path).toEqual(routePath);
  });

  it('6. routePath 用於飯店 + entry 混合路線', async () => {
    const routePath = makeRoutePath(10);
    const entryPins = makePins(2);
    const pins = [entryPins[1], HOTEL_PIN, entryPins[0]];

    const MapRoute = await getMapRoute();
    render(<MapRoute map={mockMap} pins={pins} routePath={routePath} />);

    const callArg = mockPolyline.mock.calls[0][0];
    expect(callArg.path).toEqual(routePath);
  });
});

describe('MapRoute — 動態更新', () => {
  it('7. routePath 更新 → 呼叫 setPath，不重新建立 Polyline', async () => {
    const MapRoute = await getMapRoute();
    const routePath1 = makeRoutePath(5);
    const routePath2 = makeRoutePath(8);
    const { rerender } = render(<MapRoute map={mockMap} pins={makePins(2)} routePath={routePath1} />);

    expect(mockPolyline).toHaveBeenCalledTimes(1);

    rerender(<MapRoute map={mockMap} pins={makePins(2)} routePath={routePath2} />);

    expect(mockPolyline).toHaveBeenCalledTimes(1);
    expect(mockSetPath).toHaveBeenCalledTimes(1);
    expect(mockSetPath).toHaveBeenCalledWith(routePath2);
  });
});

describe('MapRoute — cleanup', () => {
  it('8. unmount → setMap(null) 清除 Polyline', async () => {
    const MapRoute = await getMapRoute();
    const { unmount } = render(<MapRoute map={mockMap} pins={makePins(2)} routePath={makeRoutePath(5)} />);

    unmount();

    expect(mockSetMap).toHaveBeenCalledWith(null);
  });

  it('9. routePath 變 null → 清除現有 Polyline（setMap(null)）', async () => {
    const MapRoute = await getMapRoute();
    const { rerender } = render(<MapRoute map={mockMap} pins={makePins(2)} routePath={makeRoutePath(5)} />);

    rerender(<MapRoute map={mockMap} pins={makePins(2)} routePath={null} />);

    expect(mockSetMap).toHaveBeenCalledWith(null);
  });
});

describe('MapRoute — strokeColor', () => {
  it('10. getComputedStyle 回傳空值 → strokeColor 使用 #007AFF fallback', async () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration);

    const MapRoute = await getMapRoute();
    render(<MapRoute map={mockMap} pins={makePins(2)} routePath={makeRoutePath(5)} />);

    const callArg = mockPolyline.mock.calls[0][0];
    expect(callArg.strokeColor).toBe('#007AFF');
  });

  it('11. getComputedStyle 回傳 accent 值 → strokeColor 使用該值', async () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => ' #FF6B35 ',
    } as unknown as CSSStyleDeclaration);

    const MapRoute = await getMapRoute();
    render(<MapRoute map={mockMap} pins={makePins(2)} routePath={makeRoutePath(5)} />);

    const callArg = mockPolyline.mock.calls[0][0];
    expect(callArg.strokeColor).toBe('#FF6B35');
  });
});

/* ===== F005：純函式測試 buildTravelSegments + getTravelEmoji ===== */

async function getF005Utils() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import('../../src/components/trip/MapRoute') as any;
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildTravelSegments: mod.buildTravelSegments as (pins: any[]) => { midLat: number; midLng: number; label: string }[],
    getTravelEmoji: mod.getTravelEmoji as (t?: string | null) => string,
  };
}

describe('buildTravelSegments — F005 中點計算', () => {
  it('12. travelMin > 0 → 正確中點座標與 label 文字', async () => {
    const { buildTravelSegments } = await getF005Utils();
    const pins = [
      { id: 1, type: 'entry' as const, index: 1, title: 'A', lat: 26.20, lng: 127.70, sortOrder: 1 },
      { id: 2, type: 'entry' as const, index: 2, title: 'B', lat: 26.22, lng: 127.72, travelMin: 15, travelType: 'car', sortOrder: 2 },
    ];

    const segments = buildTravelSegments(pins);

    expect(segments).toHaveLength(1);
    expect(segments[0].midLat).toBeCloseTo(26.21, 4);
    expect(segments[0].midLng).toBeCloseTo(127.71, 4);
    expect(segments[0].label).toBe('🚗 15min');
  });

  it('13. travelMin 未設 → 不產生 segment', async () => {
    const { buildTravelSegments } = await getF005Utils();
    const pins = [
      { id: 1, type: 'entry' as const, index: 1, title: 'A', lat: 26.20, lng: 127.70, sortOrder: 1 },
      { id: 2, type: 'entry' as const, index: 2, title: 'B', lat: 26.22, lng: 127.72, sortOrder: 2 },
    ];

    const segments = buildTravelSegments(pins);

    expect(segments).toHaveLength(0);
  });

  it('14. 亂序輸入 → 依 sort_order 排序後計算正確中點', async () => {
    const { buildTravelSegments } = await getF005Utils();
    const pins = [
      { id: 2, type: 'entry' as const, index: 2, title: 'B', lat: 26.22, lng: 127.72, travelMin: 10, sortOrder: 2 },
      { id: 1, type: 'entry' as const, index: 1, title: 'A', lat: 26.20, lng: 127.70, sortOrder: 1 },
    ];

    const segments = buildTravelSegments(pins);

    // 中點應在 A→B 之間，不是 B→A
    expect(segments[0].midLat).toBeCloseTo((26.20 + 26.22) / 2, 4);
    expect(segments[0].midLng).toBeCloseTo((127.70 + 127.72) / 2, 4);
  });

  it('15. travelMin = 0 → 不產生 segment（0 視為無效）', async () => {
    const { buildTravelSegments } = await getF005Utils();
    const pins = [
      { id: 1, type: 'entry' as const, index: 1, title: 'A', lat: 26.20, lng: 127.70, sortOrder: 1 },
      { id: 2, type: 'entry' as const, index: 2, title: 'B', lat: 26.22, lng: 127.72, travelMin: 0, sortOrder: 2 },
    ];

    const segments = buildTravelSegments(pins);

    expect(segments).toHaveLength(0);
  });

  it('16. 多段路徑：只有有 travelMin 的 segment 顯示 label', async () => {
    const { buildTravelSegments } = await getF005Utils();
    const pins = [
      { id: 1, type: 'entry' as const, index: 1, title: 'A', lat: 26.20, lng: 127.70, sortOrder: 1 },
      { id: 2, type: 'entry' as const, index: 2, title: 'B', lat: 26.21, lng: 127.71, travelMin: 5, travelType: 'walk', sortOrder: 2 },
      { id: 3, type: 'entry' as const, index: 3, title: 'C', lat: 26.22, lng: 127.72, sortOrder: 3 }, // 無 travelMin
      { id: 4, type: 'entry' as const, index: 4, title: 'D', lat: 26.23, lng: 127.73, travelMin: 20, sortOrder: 4 },
    ];

    const segments = buildTravelSegments(pins);

    expect(segments).toHaveLength(2);
    expect(segments[0].label).toBe('🚶 5min');
    expect(segments[1].label).toBe('🚗 20min');
  });
});

describe('getTravelEmoji — F005 交通方式圖示', () => {
  it('17. walk → 🚶', async () => {
    const { getTravelEmoji } = await getF005Utils();
    expect(getTravelEmoji('walk')).toBe('🚶');
    expect(getTravelEmoji('walking')).toBe('🚶');
    expect(getTravelEmoji('foot')).toBe('🚶');
  });

  it('18. train/transit → 🚆', async () => {
    const { getTravelEmoji } = await getF005Utils();
    expect(getTravelEmoji('train')).toBe('🚆');
    expect(getTravelEmoji('subway')).toBe('🚆');
    expect(getTravelEmoji('transit')).toBe('🚆');
  });

  it('19. bus → 🚌', async () => {
    const { getTravelEmoji } = await getF005Utils();
    expect(getTravelEmoji('bus')).toBe('🚌');
  });

  it('20. 未設 / 未知類型 → 🚗 預設', async () => {
    const { getTravelEmoji } = await getF005Utils();
    expect(getTravelEmoji()).toBe('🚗');
    expect(getTravelEmoji(null)).toBe('🚗');
    expect(getTravelEmoji('car')).toBe('🚗');
    expect(getTravelEmoji('unknown')).toBe('🚗');
  });
});

describe('MapRoute — F005 OverlayView label 管理', () => {
  it('21. 有 travelMin + legMidpoints → OverlayView setMap 被呼叫', async () => {
    const MapRoute = await getMapRoute();
    const pinsWithTravel = [
      { id: 1, type: 'entry' as const, index: 1, title: 'A', lat: 26.20, lng: 127.70, sortOrder: 1 },
      { id: 2, type: 'entry' as const, index: 2, title: 'B', lat: 26.21, lng: 127.71, travelMin: 15, travelType: 'car', sortOrder: 2 },
    ];
    const legMidpoints = [{ lat: 26.205, lng: 127.705 }];

    render(<MapRoute map={mockMap} pins={pinsWithTravel} routePath={makeRoutePath(5)} legMidpoints={legMidpoints} />);

    expect(mockOverlaySetMap).toHaveBeenCalledWith(mockMap);
    expect(mockOverlaySetMap).toHaveBeenCalledTimes(1);
  });

  it('22. 無 travelMin → OverlayView setMap 不被呼叫', async () => {
    const MapRoute = await getMapRoute();
    const pinsNoTravel = [
      { id: 1, type: 'entry' as const, index: 1, title: 'A', lat: 26.20, lng: 127.70, sortOrder: 1 },
      { id: 2, type: 'entry' as const, index: 2, title: 'B', lat: 26.21, lng: 127.71, sortOrder: 2 },
    ];

    render(<MapRoute map={mockMap} pins={pinsNoTravel} routePath={makeRoutePath(5)} />);

    expect(mockOverlaySetMap).not.toHaveBeenCalled();
  });

  it('23. unmount → OverlayView setMap(null) 清除 labels', async () => {
    const MapRoute = await getMapRoute();
    const pinsWithTravel = [
      { id: 1, type: 'entry' as const, index: 1, title: 'A', lat: 26.20, lng: 127.70, sortOrder: 1 },
      { id: 2, type: 'entry' as const, index: 2, title: 'B', lat: 26.21, lng: 127.71, travelMin: 15, sortOrder: 2 },
    ];
    const legMidpoints = [{ lat: 26.205, lng: 127.705 }];

    const { unmount } = render(<MapRoute map={mockMap} pins={pinsWithTravel} routePath={makeRoutePath(5)} legMidpoints={legMidpoints} />);

    vi.clearAllMocks();
    unmount();

    expect(mockOverlaySetMap).toHaveBeenCalledWith(null);
  });
});
