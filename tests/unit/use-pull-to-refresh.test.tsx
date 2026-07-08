/**
 * usePullToRefresh — editable-target guard (v2.55.x)
 *
 * 手機在 scrollTop=0 點備註 textarea 聚焦 → 捲動/手指微移被誤判成 pull-to-refresh
 * → onRefresh()=window.location.reload() 把正在編輯的備註沖掉。景點備註 textarea
 * 與行程筆記頁輸入都在 AppShell <main> 這個 scroller 內，症狀相同。
 * guard：touch 起點落在 input/textarea/select/contenteditable 內時不 arm 下拉。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';

function dispatchTouch(target: Element, type: string, clientY: number) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: [{ clientY }], configurable: true });
  target.dispatchEvent(e);
}

let scroller: HTMLDivElement;

beforeEach(() => {
  scroller = document.createElement('div');
  // jsdom scrollTop 預設 0 — PTR 只在捲到頂端時 arm。
  document.body.appendChild(scroller);
});

afterEach(() => {
  scroller.remove();
});

describe('usePullToRefresh — editable-target guard', () => {
  it('起點非輸入框、過門檻 release → 觸發 onRefresh（既有行為不回歸）', () => {
    const onRefresh = vi.fn();
    renderHook(() => usePullToRefresh({ current: scroller }, onRefresh, { threshold: 80 }));

    // dy=200, friction 0.5 → visualPull 100 ≥ threshold 80 → refresh
    dispatchTouch(scroller, 'touchstart', 100);
    dispatchTouch(scroller, 'touchmove', 300);
    dispatchTouch(scroller, 'touchend', 300);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('起點在 textarea 內 → 不觸發 onRefresh（手機編輯備註不被 reload 沖掉）', () => {
    const onRefresh = vi.fn();
    const textarea = document.createElement('textarea');
    scroller.appendChild(textarea);
    renderHook(() => usePullToRefresh({ current: scroller }, onRefresh, { threshold: 80 }));

    // touch 起點在 textarea，事件 bubble 到 scroller 的 listener → e.target = textarea
    dispatchTouch(textarea, 'touchstart', 100);
    dispatchTouch(textarea, 'touchmove', 300);
    dispatchTouch(textarea, 'touchend', 300);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('起點在 contenteditable 內 → 不觸發 onRefresh', () => {
    const onRefresh = vi.fn();
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    scroller.appendChild(editable);
    renderHook(() => usePullToRefresh({ current: scroller }, onRefresh, { threshold: 80 }));

    dispatchTouch(editable, 'touchstart', 100);
    dispatchTouch(editable, 'touchmove', 300);
    dispatchTouch(editable, 'touchend', 300);

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
