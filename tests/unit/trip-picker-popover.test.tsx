/**
 * TripPickerPopover unit test — 2026-05-03 modal-to-fullpage migration audit
 *
 * 驗 anchored popover behavior：open=false 不 render、render trip rows、
 * 點 row → onPick(tripId)、Esc → onClose、外部點擊 → onClose。
 *
 * 這個 component 是原 ExplorePage 內 modal-style backdrop chooser 抽出共用版，
 * popover-style 對齊 region-pill / category-subtab 同類 selection menu pattern。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import TripPickerPopover from '../../src/components/explore/TripPickerPopover';

const TRIPS = [
  { tripId: 'okinawa-2026-Ray', title: '沖繩 7 日', countries: 'JP' },
  { tripId: 'seoul-2026', title: null, name: '首爾自由行', countries: 'KR' },
  { tripId: 'no-name-trip', countries: null },
];

afterEach(() => { vi.restoreAllMocks(); });

describe('TripPickerPopover', () => {
  it('open=false → 不 render', () => {
    render(
      <TripPickerPopover open={false} trips={TRIPS} selectedCount={3} onPick={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.queryByTestId('explore-trip-picker')).toBeNull();
  });

  it('open=true + trips!=null → render header (count) + 每個 trip 一個 row', () => {
    render(
      <TripPickerPopover open trips={TRIPS} selectedCount={3} onPick={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByTestId('explore-trip-picker')).toBeTruthy();
    expect(screen.getByText('已選 3 個 POI')).toBeTruthy();
    expect(screen.getByTestId('explore-trip-pick-okinawa-2026-Ray')).toBeTruthy();
    expect(screen.getByTestId('explore-trip-pick-seoul-2026')).toBeTruthy();
    expect(screen.getByTestId('explore-trip-pick-no-name-trip')).toBeTruthy();
    // title fallback: title || name || tripId
    expect(screen.getByText('沖繩 7 日')).toBeTruthy();
    expect(screen.getByText('首爾自由行')).toBeTruthy();
    expect(screen.getByText('no-name-trip')).toBeTruthy();
    // countries fallback: '—' when null
    expect(screen.getByText('JP')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('trips=null (loading) → 顯示「載入中…」', () => {
    render(
      <TripPickerPopover open trips={null} selectedCount={2} onPick={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText(/載入中/)).toBeTruthy();
  });

  it('trips=[] (empty) → 顯示「你還沒有任何行程」 fallback', () => {
    render(
      <TripPickerPopover open trips={[]} selectedCount={1} onPick={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText(/你還沒有任何行程/)).toBeTruthy();
  });

  it('點 row → onPick(tripId) called with the row id', () => {
    const onPick = vi.fn();
    render(
      <TripPickerPopover open trips={TRIPS} selectedCount={3} onPick={onPick} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByTestId('explore-trip-pick-seoul-2026'));
    expect(onPick).toHaveBeenCalledWith('seoul-2026');
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('Esc key → onClose called', () => {
    const onClose = vi.fn();
    render(
      <TripPickerPopover open trips={TRIPS} selectedCount={3} onPick={vi.fn()} onClose={onClose} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('外部 mousedown → onClose called (popover 內部 mousedown 不觸發)', () => {
    const onClose = vi.fn();
    render(
      <>
        <button data-testid="outside">outside</button>
        <TripPickerPopover open trips={TRIPS} selectedCount={3} onPick={vi.fn()} onClose={onClose} />
      </>
    );
    // popover 內 click → 不關
    fireEvent.mouseDown(screen.getByTestId('explore-trip-pick-okinawa-2026-Ray'));
    expect(onClose).toHaveBeenCalledTimes(0);
    // 外部 click → 關
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('trigger button (data-trip-picker-trigger="true") 上的 mousedown 不觸發 onClose', () => {
    const onClose = vi.fn();
    render(
      <>
        <button data-testid="trigger" data-trip-picker-trigger="true">加入行程</button>
        <TripPickerPopover open trips={TRIPS} selectedCount={3} onPick={vi.fn()} onClose={onClose} />
      </>
    );
    // trigger 自己 toggle，不該觸發 onClose 二次
    fireEvent.mouseDown(screen.getByTestId('trigger'));
    expect(onClose).toHaveBeenCalledTimes(0);
  });
});
