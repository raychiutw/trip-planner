/**
 * MapFabs unit test — Section 4.10 (terracotta-mockup-parity-v2)
 *
 * 不深 mock Leaflet（component 用 instanceof L.TileLayer + addTo），只驗：
 *   - map=null disable 兩 button
 *   - map provided enable + popover 開合
 *   - 三個 layer option 都顯示 + 點 active state 切換
 *   - 定位 button click without geolocation API → 觸發 toast (取代 window.alert)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MapFabs from '../../src/components/trip/MapFabs';
import * as Toast from '../../src/components/shared/Toast';
import type * as L from 'leaflet';

// Minimal map mock — 只實作 component 會打的 method
function makeMockMap(): L.Map {
  const map = {
    eachLayer: () => {},
    removeLayer: () => {},
    flyTo: () => {},
  } as unknown as L.Map;
  return map;
}

describe('MapFabs', () => {
  let showToastSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    showToastSpy = vi.spyOn(Toast, 'showToast').mockImplementation(() => 0);
  });
  afterEach(() => {
    showToastSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('map=null → 兩個 FAB button 都 disabled', () => {
    render(<MapFabs map={null} />);
    expect((screen.getByTestId('map-fab-layers') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('map-fab-locate') as HTMLButtonElement).disabled).toBe(true);
  });

  it('map provided → button enabled + click layer FAB 打開 popover', () => {
    render(<MapFabs map={makeMockMap()} />);
    expect((screen.getByTestId('map-fab-layers') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('map-fab-layers-popover')).toBeNull();
    fireEvent.click(screen.getByTestId('map-fab-layers'));
    expect(screen.getByTestId('map-fab-layers-popover')).toBeTruthy();
  });

  it('popover 內含 3 個 layer option', () => {
    render(<MapFabs map={makeMockMap()} />);
    fireEvent.click(screen.getByTestId('map-fab-layers'));
    expect(screen.getByTestId('map-fab-layers-option-street')).toBeTruthy();
    expect(screen.getByTestId('map-fab-layers-option-satellite')).toBeTruthy();
    expect(screen.getByTestId('map-fab-layers-option-terrain')).toBeTruthy();
  });

  it('預設 active 為 street', () => {
    render(<MapFabs map={makeMockMap()} />);
    fireEvent.click(screen.getByTestId('map-fab-layers'));
    expect(screen.getByTestId('map-fab-layers-option-street').className).toContain('is-active');
    expect(screen.getByTestId('map-fab-layers-option-satellite').className).not.toContain('is-active');
  });

  it('initialStyle prop 可改預設 active', () => {
    render(<MapFabs map={makeMockMap()} initialStyle="satellite" />);
    fireEvent.click(screen.getByTestId('map-fab-layers'));
    expect(screen.getByTestId('map-fab-layers-option-satellite').className).toContain('is-active');
  });

  it('地理 API 不存在時 click 定位 → 觸發 toast (取代 window.alert)', () => {
    // 假裝沒有 navigator.geolocation
    const oldNav = (globalThis as unknown as { navigator: Navigator }).navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...oldNav, geolocation: undefined },
      configurable: true,
    });
    render(<MapFabs map={makeMockMap()} />);
    fireEvent.click(screen.getByTestId('map-fab-locate'));
    expect(showToastSpy).toHaveBeenCalledWith('此瀏覽器不支援定位', 'error', expect.any(Number));
    Object.defineProperty(globalThis, 'navigator', { value: oldNav, configurable: true });
  });
});
