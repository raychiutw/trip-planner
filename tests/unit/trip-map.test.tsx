/**
 * Unit tests for TripMap component (F006)
 *
 * 測試：
 *   1. SDK loading → skeleton 顯示
 *   2. SDK error → error fallback + 外連 Google Maps 按鈕
 *   3. SDK ready + 無資料 → empty state
 *   4. SDK ready + 有資料 → 地圖容器 + 日期圖例
 *   5. getDayColor — 色盤分配（8 色循環）
 *   6. extractDayPins — 過濾有效 lat/lng
 *   7. 圖例 pill 點擊 → 高亮/取消高亮（aria-pressed）
 *   8. 收合/展開功能
 *   9. 圖例顯示正確天數
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

/* ===== Mock useGoogleMaps hook ===== */

const mockUseGoogleMaps = vi.fn();
vi.mock('../../src/hooks/useGoogleMaps', () => ({
  useGoogleMaps: () => mockUseGoogleMaps(),
}));

/* ===== Mock google.maps ===== */

const mockFitBounds = vi.fn();
const mockAddListener = vi.fn();
const mockSetOptions = vi.fn();
const mockPolylineSetMap = vi.fn();
const mockMarkerSetMap = vi.fn();
const mockMarkerGetIcon = vi.fn();
const mockMarkerSetIcon = vi.fn();

const mockPolyline = vi.fn(() => ({
  setMap: mockPolylineSetMap,
  setOptions: mockSetOptions,
}));

const mockMarker = vi.fn(() => ({
  setMap: mockMarkerSetMap,
  getIcon: mockMarkerGetIcon,
  setIcon: mockMarkerSetIcon,
}));

beforeEach(() => {
  // @ts-expect-error — 模擬 global google.maps
  globalThis.google = {
    maps: {
      Map: vi.fn(() => ({
        fitBounds: mockFitBounds,
        addListener: mockAddListener,
      })),
      LatLngBounds: vi.fn(() => ({ extend: vi.fn() })),
      Polyline: mockPolyline,
      Marker: mockMarker,
      ControlPosition: { RIGHT_BOTTOM: 7 },
      SymbolPath: { CIRCLE: 0 },
    },
  };

  // Reset mocks
  vi.clearAllMocks();
  mockMarkerGetIcon.mockReturnValue({ fillOpacity: 0.9 });

  // 重置 localStorage
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ===== 動態 import TripMap ===== */

async function getTripMap() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import('../../src/components/trip/TripMap') as any;
  return mod.default;
}

async function getTripMapHelpers() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import('../../src/components/trip/TripMap') as any;
  return { getDayColor: mod.getDayColor, extractDayPins: mod.extractDayPins, DAY_COLORS: mod.DAY_COLORS };
}

/* ===== 測試資料 ===== */

function makeEntry(id: number, overrides = {}) {
  return {
    id,
    sortOrder: id,
    time: `0${id + 8}:00`,
    title: `景點 ${id}`,
    location: { lat: 26.2 + id * 0.01, lng: 127.7 + id * 0.01 },
    restaurants: [],
    shopping: [],
    ...overrides,
  };
}

function makeDay(dayNum: number, entryCount = 2) {
  return {
    id: dayNum,
    dayNum,
    hotel: null,
    timeline: Array.from({ length: entryCount }, (_, i) => makeEntry(i + 1 + (dayNum - 1) * 10)),
  };
}

const SAMPLE_ALL_DAYS = {
  1: makeDay(1, 2),
  2: makeDay(2, 2),
  3: makeDay(3, 2),
};

const SAMPLE_DAY_NUMS = [1, 2, 3];

/* ===== Tests ===== */

describe('TripMap — loading state', () => {
  it('1. SDK status=loading → 顯示 skeleton', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'loading', error: null });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    expect(screen.getByTestId('trip-map-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('trip-map-container')).not.toBeInTheDocument();
  });

  it('2. SDK status=idle → 也顯示 skeleton', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'idle', error: null });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    expect(screen.getByTestId('trip-map-skeleton')).toBeInTheDocument();
  });
});

describe('TripMap — error state', () => {
  it('3. SDK status=error → 顯示 error fallback', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'error', error: '網路錯誤' });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    expect(screen.getByTestId('trip-map-error')).toBeInTheDocument();
    expect(screen.getByText('地圖無法載入')).toBeInTheDocument();
  });

  it('4. error fallback 有外連 Google Maps 按鈕', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'error', error: 'SDK failed' });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    const link = screen.getByRole('link', { name: /google maps/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
    expect(link).toHaveAttribute('target', '_blank');
  });
});

describe('TripMap — empty state', () => {
  it('5. SDK ready + 無座標資料 → empty state', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });

    const emptyDays = {
      1: { id: 1, dayNum: 1, hotel: null, timeline: [] },
    };

    const TripMap = await getTripMap();
    render(<TripMap allDays={emptyDays} dayNums={[1]} />);

    expect(screen.getByTestId('trip-map-empty')).toBeInTheDocument();
    expect(screen.getByText('尚無地點資料')).toBeInTheDocument();
  });
});

describe('TripMap — success state', () => {
  it('6. SDK ready + 有資料 → 地圖容器存在', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    expect(screen.getByTestId('trip-map-container')).toBeInTheDocument();
    expect(screen.getByTestId('trip-map-canvas')).toBeInTheDocument();
  });

  it('7. SDK ready + 有資料 → 日期圖例顯示', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    expect(screen.getByTestId('trip-map-legend')).toBeInTheDocument();
    // 3 天 → 3 個 pill
    expect(screen.getByTestId('trip-map-legend-pill-1')).toBeInTheDocument();
    expect(screen.getByTestId('trip-map-legend-pill-2')).toBeInTheDocument();
    expect(screen.getByTestId('trip-map-legend-pill-3')).toBeInTheDocument();
  });

  it('8. 圖例顯示正確的 Day N 文字', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
    expect(screen.getByText('Day 3')).toBeInTheDocument();
  });
});

describe('TripMap — 圖例 pill 互動', () => {
  it('9. 初始狀態 pill 無 aria-pressed=true', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    const pill1 = screen.getByTestId('trip-map-legend-pill-1');
    expect(pill1).toHaveAttribute('aria-pressed', 'false');
  });

  it('10. 點擊 pill → aria-pressed=true（高亮）', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    const pill1 = screen.getByTestId('trip-map-legend-pill-1');
    fireEvent.click(pill1);

    expect(pill1).toHaveAttribute('aria-pressed', 'true');
  });

  it('11. 再點相同 pill → 取消高亮（aria-pressed=false）', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    const pill1 = screen.getByTestId('trip-map-legend-pill-1');
    fireEvent.click(pill1); // 高亮
    fireEvent.click(pill1); // 取消高亮

    expect(pill1).toHaveAttribute('aria-pressed', 'false');
  });

  it('12. 高亮一天 → 其他 pill 有 dimmed class', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    fireEvent.click(screen.getByTestId('trip-map-legend-pill-1'));

    // pill-2 和 pill-3 應有 dimmed
    const pill2 = screen.getByTestId('trip-map-legend-pill-2');
    const pill3 = screen.getByTestId('trip-map-legend-pill-3');
    expect(pill2).toHaveClass('trip-map-legend-pill--dimmed');
    expect(pill3).toHaveClass('trip-map-legend-pill--dimmed');

    // pill-1 不應有 dimmed
    const pill1 = screen.getByTestId('trip-map-legend-pill-1');
    expect(pill1).not.toHaveClass('trip-map-legend-pill--dimmed');
  });
});

describe('TripMap — 收合/展開', () => {
  it('13. 預設展開：收合按鈕顯示「收合地圖」', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'loading', error: null });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    expect(screen.getByRole('button', { name: /收合地圖/i })).toBeInTheDocument();
  });

  it('14. 點擊收合 → 按鈕改為「展開地圖」', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'loading', error: null });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    fireEvent.click(screen.getByRole('button', { name: /收合地圖/i }));

    expect(screen.getByRole('button', { name: /展開地圖/i })).toBeInTheDocument();
  });
});

describe('TripMap — Accessibility', () => {
  it('15. 地圖區域有 role="region" + aria-label', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'loading', error: null });

    const TripMap = await getTripMap();
    render(<TripMap allDays={SAMPLE_ALL_DAYS} dayNums={SAMPLE_DAY_NUMS} />);

    expect(screen.getByRole('region', { name: '全行程總覽地圖' })).toBeInTheDocument();
  });
});

describe('getDayColor — 色盤分配', () => {
  it('16. Day 1 → #4285F4（藍）', async () => {
    const { getDayColor, DAY_COLORS } = await getTripMapHelpers();
    expect(getDayColor(1)).toBe(DAY_COLORS[0]);
    expect(getDayColor(1)).toBe('#4285F4');
  });

  it('17. Day 8 → #78909C（灰）', async () => {
    const { getDayColor, DAY_COLORS } = await getTripMapHelpers();
    expect(getDayColor(8)).toBe(DAY_COLORS[7]);
    expect(getDayColor(8)).toBe('#78909C');
  });

  it('18. Day 9 → 循環回 Day 1 色（#4285F4）', async () => {
    const { getDayColor } = await getTripMapHelpers();
    expect(getDayColor(9)).toBe('#4285F4');
  });

  it('19. Day 16 → 循環回 Day 8 色（#78909C）', async () => {
    const { getDayColor } = await getTripMapHelpers();
    expect(getDayColor(16)).toBe('#78909C');
  });
});

describe('extractDayPins — 從 Day 提取 pins', () => {
  it('20. 有效 lat/lng → 提取 entry pins', async () => {
    const { extractDayPins } = await getTripMapHelpers();
    const day = makeDay(1, 2);
    const pins = extractDayPins(day);

    expect(pins.length).toBe(2);
    expect(pins[0].type).toBe('entry');
  });

  it('21. 無效 lat/lng（0,0）→ 過濾掉', async () => {
    const { extractDayPins } = await getTripMapHelpers();
    const day = {
      id: 1,
      dayNum: 1,
      hotel: null,
      timeline: [
        { id: 1, sortOrder: 1, title: '景點 1', location: { lat: 0, lng: 0 }, restaurants: [], shopping: [] },
        { id: 2, sortOrder: 2, title: '景點 2', location: { lat: 26.2, lng: 127.7 }, restaurants: [], shopping: [] },
      ],
    };

    const pins = extractDayPins(day as Parameters<typeof extractDayPins>[0]);
    expect(pins.length).toBe(1);
    expect(pins[0].id).toBe(2);
  });

  it('22. 含飯店 lat/lng → 飯店 pin 在最前（sortOrder=-1）', async () => {
    const { extractDayPins } = await getTripMapHelpers();
    const day = {
      id: 1,
      dayNum: 1,
      hotel: {
        id: 99,
        name: '那霸飯店',
        location: { lat: 26.19, lng: 127.68 },
        shopping: [],
      },
      timeline: [
        { id: 1, sortOrder: 1, title: '景點 1', location: { lat: 26.2, lng: 127.7 }, restaurants: [], shopping: [] },
      ],
    };

    const pins = extractDayPins(day as Parameters<typeof extractDayPins>[0]);
    expect(pins.length).toBe(2);
    expect(pins[0].type).toBe('hotel');
    expect(pins[0].sortOrder).toBe(-1);
  });

  it('23. 無任何座標 → 回傳空陣列', async () => {
    const { extractDayPins } = await getTripMapHelpers();
    const day = {
      id: 1,
      dayNum: 1,
      hotel: null,
      timeline: [],
    };

    const pins = extractDayPins(day as Parameters<typeof extractDayPins>[0]);
    expect(pins).toHaveLength(0);
  });
});
