/**
 * usePullToRefresh — editable-target guard (v2.55.x)
 *
 * 手機在 scrollTop=0 點備註 textarea 聚焦 → 捲動/手指微移被誤判成 pull-to-refresh
 * → onRefresh()=window.location.reload() 把正在編輯的備註沖掉。景點備註 textarea
 * 與行程筆記頁輸入都在 AppShell <main> 這個 scroller 內，症狀相同。
 * guard：touch 起點落在 input/textarea/select/contenteditable 內時不 arm 下拉。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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

/**
 * 內層捲動容器 guard（AI 聊天 bug）
 *
 * AI 聊天頁的訊息清單是 AppShell <main> 內的內層 scroller（.tp-chat-body）；<main> 自己的
 * scrollTop 恆為 0。在 iPhone 往下拖想看較早的訊息，touch 起點落在內層 scroller 且它還能往上捲，
 * 卻被當成 <main> 的下拉刷新 → 整頁位移，放開後 onRefresh()=reload，捲動位置被洗回最底，
 * 使用者感受是「聊天視窗無法滑動」。guard：起點到 <main> 之間若有「可捲且已捲離頂端」的內層容器，不 arm。
 */
function innerScroller(scrollTop: number): HTMLDivElement {
  const inner = document.createElement('div');
  inner.style.overflowY = 'auto';
  Object.defineProperty(inner, 'scrollTop', { value: scrollTop, configurable: true });
  Object.defineProperty(inner, 'scrollHeight', { value: 3000, configurable: true });
  Object.defineProperty(inner, 'clientHeight', { value: 600, configurable: true });
  return inner;
}

function pullDown(target: Element) {
  dispatchTouch(target, 'touchstart', 100);
  dispatchTouch(target, 'touchmove', 300);
  dispatchTouch(target, 'touchend', 300);
}

describe('usePullToRefresh — 內層捲動容器 guard', () => {
  it('起點在已捲離頂端的內層 scroller（聊天往上看歷史）→ 不觸發 onRefresh', () => {
    const onRefresh = vi.fn();
    const inner = innerScroller(2908);
    const bubble = document.createElement('p');
    inner.appendChild(bubble);
    scroller.appendChild(inner);
    renderHook(() => usePullToRefresh({ current: scroller }, onRefresh, { threshold: 80 }));

    pullDown(bubble);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('起點在內層 scroller 且它已在頂端（聊天捲到最舊）→ 仍可下拉刷新', () => {
    const onRefresh = vi.fn();
    const inner = innerScroller(0);
    const bubble = document.createElement('p');
    inner.appendChild(bubble);
    scroller.appendChild(inner);
    renderHook(() => usePullToRefresh({ current: scroller }, onRefresh, { threshold: 80 }));

    pullDown(bubble);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('起點在內層 scroller 已捲離頂端時，main 不被位移（pullPx 維持 0）', () => {
    const inner = innerScroller(500);
    scroller.appendChild(inner);
    const { result } = renderHook(() => usePullToRefresh({ current: scroller }, vi.fn(), { threshold: 80 }));

    act(() => {
      dispatchTouch(inner, 'touchstart', 100);
      dispatchTouch(inner, 'touchmove', 300);
    });

    expect(result.current.pullPx).toBe(0);
  });
});
