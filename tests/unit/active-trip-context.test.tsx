/**
 * ActiveTripContext unit test — Section 5 (terracotta-mockup-parity-v2 / E4)
 *
 * 驗：
 *   - useActiveTrip() 在 provider 內 init 自 localStorage
 *   - setActiveTrip(id) 寫入 localStorage + state update
 *   - setActiveTrip(null) 清除 localStorage
 *   - 跨 tab storage event 同步
 *   - useActiveTrip() 在 provider 外 fallback 直接讀 localStorage (degraded)
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ActiveTripProvider, useActiveTrip } from '../../src/contexts/ActiveTripContext';
import { LS_KEY_TRIP_PREF, LS_PREFIX, lsGet, lsRemove, lsSet } from '../../src/lib/localStorage';

function Probe() {
  const { activeTripId, setActiveTrip } = useActiveTrip();
  return (
    <div>
      <span data-testid="active-id">{activeTripId ?? 'null'}</span>
      <button data-testid="set-okinawa" onClick={() => setActiveTrip('okinawa')}>set okinawa</button>
      <button data-testid="set-null" onClick={() => setActiveTrip(null)}>clear</button>
    </div>
  );
}

beforeEach(() => {
  lsRemove(LS_KEY_TRIP_PREF);
});

describe('ActiveTripContext', () => {
  it('init from localStorage value when provider mounts', () => {
    lsSet(LS_KEY_TRIP_PREF, 'preset-trip');
    render(
      <ActiveTripProvider>
        <Probe />
      </ActiveTripProvider>,
    );
    expect(screen.getByTestId('active-id').textContent).toBe('preset-trip');
  });

  it('init null when localStorage empty', () => {
    render(
      <ActiveTripProvider>
        <Probe />
      </ActiveTripProvider>,
    );
    expect(screen.getByTestId('active-id').textContent).toBe('null');
  });

  it('setActiveTrip 寫入 localStorage + state 更新', () => {
    render(
      <ActiveTripProvider>
        <Probe />
      </ActiveTripProvider>,
    );
    expect(screen.getByTestId('active-id').textContent).toBe('null');
    act(() => {
      screen.getByTestId('set-okinawa').click();
    });
    expect(screen.getByTestId('active-id').textContent).toBe('okinawa');
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('okinawa');
  });

  it('setActiveTrip(null) 清除 localStorage', () => {
    lsSet(LS_KEY_TRIP_PREF, 'preset-trip');
    render(
      <ActiveTripProvider>
        <Probe />
      </ActiveTripProvider>,
    );
    expect(screen.getByTestId('active-id').textContent).toBe('preset-trip');
    act(() => {
      screen.getByTestId('set-null').click();
    });
    expect(screen.getByTestId('active-id').textContent).toBe('null');
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBeNull();
  });

  it('跨 tab storage event sync — 另一 tab 改 trip-pref 觸發 state 更新', () => {
    render(
      <ActiveTripProvider>
        <Probe />
      </ActiveTripProvider>,
    );
    // 模擬另一 tab 寫入 localStorage 同 key + dispatch storage event
    const newValue = JSON.stringify({ v: 'kyoto', exp: Date.now() + 86400000 });
    localStorage.setItem(`${LS_PREFIX}${LS_KEY_TRIP_PREF}`, newValue);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: `${LS_PREFIX}${LS_KEY_TRIP_PREF}`,
        newValue,
        oldValue: null,
      }));
    });
    expect(screen.getByTestId('active-id').textContent).toBe('kyoto');
  });

  it('跨 tab storage event 清除 — newValue=null 觸發 reset', () => {
    lsSet(LS_KEY_TRIP_PREF, 'preset-trip');
    render(
      <ActiveTripProvider>
        <Probe />
      </ActiveTripProvider>,
    );
    expect(screen.getByTestId('active-id').textContent).toBe('preset-trip');
    localStorage.removeItem(`${LS_PREFIX}${LS_KEY_TRIP_PREF}`);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: `${LS_PREFIX}${LS_KEY_TRIP_PREF}`,
        newValue: null,
        oldValue: 'old',
      }));
    });
    expect(screen.getByTestId('active-id').textContent).toBe('null');
  });

  it('useActiveTrip() 在 provider 外 fallback 直接讀 localStorage (degraded mode)', () => {
    lsSet(LS_KEY_TRIP_PREF, 'no-provider-trip');
    render(<Probe />);
    expect(screen.getByTestId('active-id').textContent).toBe('no-provider-trip');
  });
});
