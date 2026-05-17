import { describe, it, expect, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ToastContainer, { showToast, dismissToast, showErrorToast, resetToasts } from '../../src/components/shared/Toast';

afterEach(() => {
  act(() => { resetToasts(); });
  cleanup();
});

describe('ToastContainer + showToast', () => {
  it('showToast 顯示訊息', () => {
    const { getByText } = render(<ToastContainer />);
    act(() => { showToast('測試訊息', 'info'); });
    expect(getByText('測試訊息')).toBeTruthy();
  });

  it('多個 toast 可堆疊', () => {
    const { getAllByRole } = render(<ToastContainer />);
    act(() => {
      showToast('訊息 1', 'info');
      showToast('訊息 2', 'error');
    });
    expect(getAllByRole('alert')).toHaveLength(2);
  });

  it('error toast 有 tp-toast--error 樣式 class', () => {
    const { getByRole } = render(<ToastContainer />);
    act(() => { showToast('錯誤', 'error'); });
    const el = getByRole('alert');
    expect(el.className).toContain('tp-toast--error');
  });

  it('success toast 有 tp-toast--success 樣式 class', () => {
    const { getByRole } = render(<ToastContainer />);
    act(() => { showToast('成功', 'success'); });
    const el = getByRole('alert');
    expect(el.className).toContain('tp-toast--success');
  });

  it('有 role="alert" 和 aria-live', () => {
    const { getByRole } = render(<ToastContainer />);
    act(() => { showToast('test', 'info'); });
    const el = getByRole('alert');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('true');
  });

  it('dismissToast 移除指定 toast', () => {
    const { queryByText } = render(<ToastContainer />);
    act(() => {
      showToast('會消失', 'info');
    });
    expect(queryByText('會消失')).toBeTruthy();
  });
});

/**
 * v2.31.38 — Toast V1 redesign：dot indicator + 白底，對齊 mockup .tp-status-toast。
 * 拔掉 type-icon SVG（previously: error/success/info/offline/online 各一個 svg）。
 */
describe('v2.31.38 Toast V1 redesign — dot indicator, no SVG icon', () => {
  it('bubble 不含 SVG icon（dot 改 via CSS ::before）', () => {
    const { getByRole } = render(<ToastContainer />);
    act(() => { showToast('沒有 icon', 'error'); });
    const el = getByRole('alert');
    expect(el.querySelector('svg')).toBeNull();
  });

  it('bubble 套用 tp-toast prefix class（識別 V1 重設計）', () => {
    const { getByRole } = render(<ToastContainer />);
    act(() => { showToast('test', 'info'); });
    expect(getByRole('alert').className).toContain('tp-toast');
  });

  it('offline 不再含 SVG line（type icon 全拔）', () => {
    const { container } = render(<ToastContainer />);
    act(() => { showToast('離線', 'offline'); });
    expect(container.querySelector('line')).toBeNull();
  });

  it('online 不再含 SVG checkmark', () => {
    const { container } = render(<ToastContainer />);
    act(() => { showToast('上線', 'online'); });
    // bubble 本身應該不含 svg，但 ToastContainer wrapper 可能在無 svg 狀態
    const bubble = container.querySelector('[role="alert"]');
    expect(bubble?.querySelector('svg')).toBeNull();
  });
});

/**
 * v2.31.38 — Centering regression：keyframes 拔掉 translateX(-50%)（legacy 自身置中），
 * 由 container 的 flex items-center 負責。雙重置中疊加 → bubble 被往左推一半 bubble 寬。
 */
describe('v2.31.38 keyframes centering regression', () => {
  const tokensCss = readFileSync(resolve(__dirname, '../../css/tokens.css'), 'utf8');

  it('@keyframes toast-slide-down 不再含 translateX', () => {
    const match = tokensCss.match(/@keyframes toast-slide-down\s*\{[^}]+\}/);
    expect(match).toBeTruthy();
    expect(match![0]).not.toMatch(/translateX/);
  });

  it('@keyframes toast-slide-up 不再含 translateX', () => {
    const match = tokensCss.match(/@keyframes toast-slide-up\s*\{[^}]+\}/);
    expect(match).toBeTruthy();
    expect(match![0]).not.toMatch(/translateX/);
  });
});

describe('showErrorToast', () => {
  it('minor severity 不顯示 toast', () => {
    const { queryByRole } = render(<ToastContainer />);
    act(() => { showErrorToast('輕微錯誤', 'minor'); });
    expect(queryByRole('alert')).toBeNull();
  });

  it('moderate severity 顯示 error toast', () => {
    const { getByRole } = render(<ToastContainer />);
    act(() => { showErrorToast('中等錯誤', 'moderate'); });
    expect(getByRole('alert').className).toContain('tp-toast--error');
  });

  it('severe severity 顯示 error toast', () => {
    const { getByRole } = render(<ToastContainer />);
    act(() => { showErrorToast('嚴重錯誤', 'severe'); });
    expect(getByRole('alert').className).toContain('tp-toast--error');
  });

  it('background severity 顯示 info toast', () => {
    const { getByRole } = render(<ToastContainer />);
    act(() => { showErrorToast('背景通知', 'background'); });
    expect(getByRole('alert').className).toContain('tp-toast');
  });
});
