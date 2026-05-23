/**
 * use-dark-mode-body-class.test.tsx — v2.33.40 round 4.5
 *
 * v2.31.25 已修「dark mode 切完 page 後 body.dark class 沒套」regression。
 * 既有 use-dark-mode.test.js 只測 localStorage round-trip 沒覆蓋 body.dark
 * effect — 不裝 guard test 同 bug 會在未來再上 prod。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../src/lib/localStorage', () => ({
  lsSet: vi.fn(() => true),
  lsGet: vi.fn(() => null),
}));

import { useDarkMode } from '../../src/hooks/useDarkMode';
import { lsGet } from '../../src/lib/localStorage';

const mockLsGet = vi.mocked(lsGet);

beforeEach(() => {
  document.body.classList.remove('dark');
  mockLsGet.mockReset();
  mockLsGet.mockReturnValue(null);
});
afterEach(() => {
  document.body.classList.remove('dark');
});

describe('useDarkMode — body.dark class effect (v2.31.25 regression guard)', () => {
  it('default (no saved mode + system not dark) → no body.dark class', () => {
    // jsdom matchMedia stub defaults to matches=false
    renderHook(() => useDarkMode());
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('saved mode = "dark" → body.dark class applied on mount', () => {
    mockLsGet.mockImplementation((key) => (key === 'color-mode' ? 'dark' : null));
    renderHook(() => useDarkMode());
    expect(document.body.classList.contains('dark')).toBe(true);
  });

  it('saved mode = "light" → body.dark removed', () => {
    document.body.classList.add('dark'); // pre-existing
    mockLsGet.mockImplementation((key) => (key === 'color-mode' ? 'light' : null));
    renderHook(() => useDarkMode());
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('setColorMode("dark") → body.dark class added', () => {
    const { result } = renderHook(() => useDarkMode());
    act(() => { result.current.setColorMode('dark'); });
    expect(document.body.classList.contains('dark')).toBe(true);
  });

  it('setColorMode → setColorMode toggles class correctly', () => {
    const { result } = renderHook(() => useDarkMode());
    act(() => { result.current.setColorMode('dark'); });
    expect(document.body.classList.contains('dark')).toBe(true);
    act(() => { result.current.setColorMode('light'); });
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('toggleDark switches both isDark and body.dark', () => {
    const { result } = renderHook(() => useDarkMode());
    act(() => { result.current.toggleDark(); });
    expect(result.current.isDark).toBe(true);
    expect(document.body.classList.contains('dark')).toBe(true);
    act(() => { result.current.toggleDark(); });
    expect(result.current.isDark).toBe(false);
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('legacy "dark"=1 (pre v2.31.25) backfills to dark mode', () => {
    mockLsGet.mockImplementation((key) => (key === 'dark' ? '1' : null));
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.isDark).toBe(true);
    expect(document.body.classList.contains('dark')).toBe(true);
  });
});
