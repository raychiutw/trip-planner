/**
 * Unit tests for DayMap component
 *
 * 測試：
 *   1. SDK loading → skeleton 顯示
 *   2. SDK error → error fallback + 外連 Google Maps 按鈕
 *   3. SDK ready + 無資料 → empty state
 *   4. SDK ready + 有資料 → 地圖容器
 *   5. 收合/展開功能 — aria-expanded、aria-hidden
 *   6. missingCount > 0 → 提示條顯示
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

/* ===== Mock useGoogleMaps hook ===== */

const mockUseGoogleMaps = vi.fn();
vi.mock('../../src/hooks/useGoogleMaps', () => ({
  useGoogleMaps: () => mockUseGoogleMaps(),
}));

/* ===== Mock useMapData hook ===== */

const mockUseMapData = vi.fn();
vi.mock('../../src/hooks/useMapData', () => ({
  useMapData: () => mockUseMapData(),
}));

/* ===== Mock MapMarker — 避免 OverlayView 相依 google.maps ===== */
vi.mock('../../src/components/trip/MapMarker', () => ({
  MapMarker: vi.fn(function() { return null; }),
}));

/* ===== Mock google.maps (不需要實際 SDK) ===== */

const mockFitBounds = vi.fn();
const mockAddListener = vi.fn();
const mockMap = vi.fn(function() { return { fitBounds: mockFitBounds, panTo: vi.fn(), addListener: mockAddListener }; });

beforeEach(() => {
  // @ts-expect-error — 模擬 global google.maps
  globalThis.google = {
    maps: {
      Map: mockMap,
      LatLngBounds: vi.fn(function() { return { extend: vi.fn() }; }),
      ControlPosition: { RIGHT_BOTTOM: 7 },
      // F005：createTravelLabelOverlay 工廠需要 OverlayView
      OverlayView: class { setMap = vi.fn(); onAdd() {} draw() {} onRemove() {} },
      LatLng: vi.fn((lat: number, lng: number) => ({ lat, lng })),
    },
  };

  // 重置 localStorage
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ===== 動態 import DayMap ===== */

async function getDayMap() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import('../../src/components/trip/DayMap') as any;
  return mod.default;
}

/* ===== 測試資料 ===== */

const makeDay = () => ({
  id: 1,
  dayNum: 1,
  hotel: null,
  timeline: [],
});

/* ===== Tests ===== */

describe('DayMap — loading state', () => {
  it('1. SDK status=loading → 顯示 skeleton', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'loading', error: null });
    mockUseMapData.mockReturnValue({ pins: [], missingCount: 0, hasData: false });

    const DayMap = await getDayMap();
    render(<DayMap day={makeDay()} dayNum={1} />);

    expect(screen.getByTestId('day-map-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('day-map-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('day-map-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('day-map-container')).not.toBeInTheDocument();
  });

  it('2. SDK status=idle → 也顯示 skeleton', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'idle', error: null });
    mockUseMapData.mockReturnValue({ pins: [], missingCount: 0, hasData: false });

    const DayMap = await getDayMap();
    render(<DayMap day={makeDay()} dayNum={1} />);

    expect(screen.getByTestId('day-map-skeleton')).toBeInTheDocument();
  });
});

describe('DayMap — error state', () => {
  it('3. SDK status=error → 顯示 error fallback', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'error', error: '網路錯誤' });
    mockUseMapData.mockReturnValue({ pins: [], missingCount: 0, hasData: false });

    const DayMap = await getDayMap();
    render(<DayMap day={makeDay()} dayNum={1} />);

    expect(screen.getByTestId('day-map-error')).toBeInTheDocument();
    expect(screen.getByText('地圖無法載入')).toBeInTheDocument();
    expect(screen.queryByTestId('day-map-skeleton')).not.toBeInTheDocument();
  });

  it('4. error fallback 有外連 Google Maps 按鈕', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'error', error: 'SDK failed' });
    mockUseMapData.mockReturnValue({ pins: [], missingCount: 0, hasData: false });

    const DayMap = await getDayMap();
    render(<DayMap day={makeDay()} dayNum={1} />);

    const link = screen.getByRole('link', { name: /google maps/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('DayMap — empty state', () => {
  it('5. SDK ready + 無座標資料 → 顯示 empty state', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });
    mockUseMapData.mockReturnValue({ pins: [], missingCount: 0, hasData: false });

    const DayMap = await getDayMap();
    render(<DayMap day={makeDay()} dayNum={1} />);

    expect(screen.getByTestId('day-map-empty')).toBeInTheDocument();
    expect(screen.getByText('今天沒有排程景點座標')).toBeInTheDocument();
    expect(screen.queryByTestId('day-map-container')).not.toBeInTheDocument();
  });
});

describe('DayMap — success state', () => {
  it('6. SDK ready + 有資料 → 顯示地圖容器', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });
    mockUseMapData.mockReturnValue({
      pins: [{ id: 1, type: 'entry', index: 1, title: '首里城', lat: 26.2, lng: 127.7, sortOrder: 1 }],
      missingCount: 0,
      hasData: true,
    });

    const DayMap = await getDayMap();
    render(<DayMap day={makeDay()} dayNum={1} />);

    expect(screen.getByTestId('day-map-container')).toBeInTheDocument();
    expect(screen.getByTestId('day-map-canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('day-map-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('day-map-skeleton')).not.toBeInTheDocument();
  });
});

describe('DayMap — 收合/展開', () => {
  it('7. 預設展開：aria-expanded=true，地圖區域 aria-hidden=false', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });
    mockUseMapData.mockReturnValue({ pins: [], missingCount: 0, hasData: false });

    const DayMap = await getDayMap();
    const { container } = render(<DayMap day={makeDay()} dayNum={1} />);

    const btn = screen.getByRole('button', { name: /收合地圖/i });
    expect(btn).toHaveAttribute('aria-expanded', 'true');

    // 直接查 DOM（aria-hidden=true 時 getByRole 找不到）
    const region = container.querySelector('[id="day-map-1"]');
    expect(region).toHaveAttribute('aria-hidden', 'false');
  });

  it('8. 點擊收合按鈕 → aria-expanded=false，顯示「展開地圖」', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });
    mockUseMapData.mockReturnValue({ pins: [], missingCount: 0, hasData: false });

    const DayMap = await getDayMap();
    const { container } = render(<DayMap day={makeDay()} dayNum={1} />);

    const btn = screen.getByRole('button', { name: /收合地圖/i });
    fireEvent.click(btn);

    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /展開地圖/i })).toBeInTheDocument();

    // 收合後 aria-hidden=true（用 querySelector 查，繞過 aria-hidden 限制）
    const region = container.querySelector('[id="day-map-1"]');
    expect(region).toHaveAttribute('aria-hidden', 'true');
  });

  it('9. 收合再展開 → 回到展開狀態', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });
    mockUseMapData.mockReturnValue({ pins: [], missingCount: 0, hasData: false });

    const DayMap = await getDayMap();
    render(<DayMap day={makeDay()} dayNum={1} />);

    // 收合
    fireEvent.click(screen.getByRole('button', { name: /收合地圖/i }));
    // 展開
    fireEvent.click(screen.getByRole('button', { name: /展開地圖/i }));

    const btn = screen.getByRole('button', { name: /收合地圖/i });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('DayMap — missingCount 提示條', () => {
  it('10. missingCount=2, status=ready → 顯示提示條', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });
    mockUseMapData.mockReturnValue({
      pins: [{ id: 1, type: 'entry', index: 1, title: '首里城', lat: 26.2, lng: 127.7, sortOrder: 1 }],
      missingCount: 2,
      hasData: true,
    });

    const DayMap = await getDayMap();
    render(<DayMap day={makeDay()} dayNum={1} />);

    expect(screen.getByTestId('day-map-warning')).toBeInTheDocument();
    expect(screen.getByText(/2 個景點缺少座標/)).toBeInTheDocument();
  });

  it('11. missingCount=0 → 不顯示提示條', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });
    mockUseMapData.mockReturnValue({
      pins: [{ id: 1, type: 'entry', index: 1, title: '首里城', lat: 26.2, lng: 127.7, sortOrder: 1 }],
      missingCount: 0,
      hasData: true,
    });

    const DayMap = await getDayMap();
    render(<DayMap day={makeDay()} dayNum={1} />);

    expect(screen.queryByTestId('day-map-warning')).not.toBeInTheDocument();
  });

  it('12. 收合時不顯示提示條', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'ready', error: null });
    mockUseMapData.mockReturnValue({
      pins: [{ id: 1, type: 'entry', index: 1, title: '首里城', lat: 26.2, lng: 127.7, sortOrder: 1 }],
      missingCount: 2,
      hasData: true,
    });

    const DayMap = await getDayMap();
    render(<DayMap day={makeDay()} dayNum={1} />);

    // 收合
    fireEvent.click(screen.getByRole('button', { name: /收合地圖/i }));
    expect(screen.queryByTestId('day-map-warning')).not.toBeInTheDocument();
  });
});

describe('DayMap — Accessibility', () => {
  it('13. 地圖區域有正確 role="region" + aria-label', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'loading', error: null });
    mockUseMapData.mockReturnValue({ pins: [], missingCount: 0, hasData: false });

    const DayMap = await getDayMap();
    render(<DayMap day={makeDay()} dayNum={3} />);

    expect(screen.getByRole('region', { name: '第 3 天動線地圖' })).toBeInTheDocument();
  });

  it('14. 收合按鈕有 aria-controls 指向地圖 id', async () => {
    mockUseGoogleMaps.mockReturnValue({ status: 'loading', error: null });
    mockUseMapData.mockReturnValue({ pins: [], missingCount: 0, hasData: false });

    const DayMap = await getDayMap();
    render(<DayMap day={makeDay()} dayNum={2} />);

    const btn = screen.getByRole('button', { name: /收合地圖/i });
    expect(btn).toHaveAttribute('aria-controls', 'day-map-2');
  });
});
