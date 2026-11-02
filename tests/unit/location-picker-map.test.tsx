import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LocationPickerMap } from '../../src/components/trip/LocationPickerMap';

const listeners = new Map<string, () => void>();
let center = { lat: 35, lng: 139 };
const flyTo = vi.fn((next: { lat: number; lng: number }) => { center = next; });
const map = {
  addListener: vi.fn((name: string, callback: () => void) => {
    listeners.set(name, callback);
    return { remove: () => listeners.delete(name) };
  }),
  getCenter: () => ({ lat: () => center.lat, lng: () => center.lng }),
  getZoom: () => 14,
  panBy: vi.fn(() => { center = { lat: center.lat + 0.001, lng: center.lng }; }),
};
let loadError: Error | null = null;
vi.mock('../../src/hooks/useGoogleMap', () => ({
  useGoogleMap: () => ({ containerRef: { current: null }, map, loadError, flyTo }),
}));

beforeEach(() => {
  listeners.clear();
  center = { lat: 35, lng: 139 };
  loadError = null;
  vi.clearAllMocks();
});

describe('LocationPickerMap', () => {
  it('keeps the viewport default unselected until a real map drag', () => {
    const onCoordChange = vi.fn();
    render(<LocationPickerMap initialCenter={center} onCoordChange={onCoordChange} />);
    act(() => listeners.get('idle')?.());
    expect(onCoordChange).not.toHaveBeenCalled();
    expect(screen.getByRole('application').getAttribute('aria-label')).toContain('地圖中心');

    center = { lat: 36, lng: 140 };
    act(() => {
      listeners.get('dragstart')?.();
      listeners.get('idle')?.();
    });
    expect(onCoordChange).toHaveBeenCalledWith({ lat: 36, lng: 140 });
  });

  it('lets arrow keys select a valid center', () => {
    const onCoordChange = vi.fn();
    render(<LocationPickerMap initialCenter={center} onCoordChange={onCoordChange} />);
    fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' });
    act(() => listeners.get('idle')?.());
    expect(onCoordChange).toHaveBeenCalledOnce();
  });

  it('does not select a coordinate when map loading fails', () => {
    loadError = new Error('denied');
    const onCoordChange = vi.fn();
    render(<LocationPickerMap initialCenter={center} onCoordChange={onCoordChange} />);
    expect(screen.getByRole('alert').textContent).toContain('搜尋景點');
    expect(onCoordChange).not.toHaveBeenCalled();
  });
});
