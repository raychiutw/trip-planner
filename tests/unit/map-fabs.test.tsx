/**
 * MapFabs contract tests (post v2.23.0 Google Maps rewrite).
 *
 * Verifies:
 *   - 3 preset names changed: 街道→路線圖 / 衛星→衛星 / 地形→混合
 *   - Active state defaults to roadmap
 *   - Click preset → map.setMapTypeId called with correct enum value
 *   - Popover toggle by clicking the layer button
 *   - Popover only renders when open
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { setupGoogleMapsMock, getMockMap } from './__mocks__/google-maps';
import MapFabs from '../../src/components/trip/MapFabs';

beforeEach(setupGoogleMapsMock);

function makeMap(): google.maps.Map {
  // Trigger one Map construction so getMockMap returns a stub
  const el = document.createElement('div');
  return new google.maps.Map(el, {});
}

describe('MapFabs (Google Maps preset switcher)', () => {
  it('預設 active 為 roadmap (路線圖)', () => {
    const map = makeMap();
    render(<MapFabs map={map} />);
    fireEvent.click(screen.getByTestId('map-fab-layers'));
    const roadmap = screen.getByTestId('map-fab-layers-option-roadmap');
    expect(roadmap.getAttribute('aria-checked')).toBe('true');
  });

  it('popover 內含 3 個 layer option (路線圖 / 衛星 / 混合)', () => {
    const map = makeMap();
    render(<MapFabs map={map} />);
    fireEvent.click(screen.getByTestId('map-fab-layers'));
    expect(screen.getByTestId('map-fab-layers-option-roadmap').textContent).toBe('路線圖');
    expect(screen.getByTestId('map-fab-layers-option-satellite').textContent).toBe('衛星');
    expect(screen.getByTestId('map-fab-layers-option-hybrid').textContent).toBe('混合');
  });

  it('click 衛星 option → map.setMapTypeId("satellite")', () => {
    const map = makeMap();
    render(<MapFabs map={map} />);
    fireEvent.click(screen.getByTestId('map-fab-layers'));
    fireEvent.click(screen.getByTestId('map-fab-layers-option-satellite'));
    const mockMap = getMockMap();
    expect(mockMap?.setMapTypeId).toHaveBeenCalledWith('satellite');
  });

  it('click 混合 option → map.setMapTypeId("hybrid")', () => {
    const map = makeMap();
    render(<MapFabs map={map} />);
    fireEvent.click(screen.getByTestId('map-fab-layers'));
    fireEvent.click(screen.getByTestId('map-fab-layers-option-hybrid'));
    expect(getMockMap()?.setMapTypeId).toHaveBeenCalledWith('hybrid');
  });

  it('popover 起始 closed (popover 不渲染)', () => {
    const map = makeMap();
    render(<MapFabs map={map} />);
    expect(screen.queryByTestId('map-fab-layers-popover')).toBeNull();
  });

  it('click layers fab → popover 開啟', () => {
    const map = makeMap();
    render(<MapFabs map={map} />);
    fireEvent.click(screen.getByTestId('map-fab-layers'));
    expect(screen.getByTestId('map-fab-layers-popover')).toBeTruthy();
  });

  it('click 同一 preset → popover 關閉，不重複 setMapTypeId', () => {
    const map = makeMap();
    render(<MapFabs map={map} />);
    fireEvent.click(screen.getByTestId('map-fab-layers'));
    fireEvent.click(screen.getByTestId('map-fab-layers-option-roadmap'));
    expect(screen.queryByTestId('map-fab-layers-popover')).toBeNull();
    expect(getMockMap()?.setMapTypeId).not.toHaveBeenCalled();
  });

  it('map=null → layer fab disabled', () => {
    render(<MapFabs map={null} />);
    expect(screen.getByTestId('map-fab-layers')).toBeDisabled();
  });
});
