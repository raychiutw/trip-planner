/**
 * Unit tests for useOnlineStatus hook 離線偵測行為
 *
 * 測試三個信號來源：
 *   1. navigator.onLine 初始狀態
 *   2. window 'online' / 'offline' 事件（含 3 秒 debounce）
 *   3. reportFetchResult() 從 apiFetch 驅動
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus, reportFetchResult } from '../../src/hooks/useOnlineStatus';

// ===== Helper: dispatch window event =====
function fireWindowEvent(type: 'online' | 'offline') {
  window.dispatchEvent(new Event(type));
}

// ===== Setup / Teardown =====

beforeEach(() => {
  vi.useFakeTimers();
  // 預設 navigator.onLine = true（模擬大多數測試的起始狀態）
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  // 還原 navigator.onLine 為 true
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => true,
  });
});

// ===== Tests =====

describe('useOnlineStatus — 初始狀態', () => {
  it('1. navigator.onLine = true 時，hook 初始回傳 true', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('2. navigator.onLine = false 時，hook 初始回傳 false', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });
});

describe('useOnlineStatus — window 事件處理', () => {
  it('3. 觸發 window online 事件後立即變 true（無 debounce）', () => {
    // 先設定初始為離線
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    // 觸發 online 事件
    act(() => {
      fireWindowEvent('online');
    });

    // 不需要 advance timer，應立即變 true
    expect(result.current).toBe(true);
  });

  it('4. 觸發 window offline 事件後，3 秒內仍為 true，3 秒後變 false（debounce）', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      fireWindowEvent('offline');
    });

    // 3 秒內仍為 true（debounce 尚未觸發）
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current).toBe(true);

    // 跨過 3 秒門檻後變為 false
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('5. 離線後快速恢復：offline → 2 秒後 online → 不應變成 false（debounce 被取消）', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    // 觸發 offline（啟動 3 秒 debounce）
    act(() => {
      fireWindowEvent('offline');
    });

    // 2 秒後（debounce 尚未到期）觸發 online → 應取消 debounce
    act(() => {
      vi.advanceTimersByTime(2000);
      fireWindowEvent('online');
    });

    // 確認此時仍為 true（online 立即生效）
    expect(result.current).toBe(true);

    // 繼續推進超過原本 debounce 時間，確認不會變 false
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(true);
  });
});

describe('useOnlineStatus — reportFetchResult 整合', () => {
  it('6. 呼叫 reportFetchResult(false) → 3 秒後 hook 變 false', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    // 模擬 apiFetch 回報網路失敗
    act(() => {
      reportFetchResult(false);
    });

    // 3 秒內仍為 true（debounce）
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current).toBe(true);

    // 3 秒後變 false
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('7. 先離線，呼叫 reportFetchResult(true) → 立即變 true', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    // 模擬 apiFetch 成功回報 → 立即恢復上線
    act(() => {
      reportFetchResult(true);
    });

    // 不需 advance timer，應立即為 true
    expect(result.current).toBe(true);
  });
});
