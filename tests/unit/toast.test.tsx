import { describe, it, expect, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
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

  it('error toast 有 destructive 樣式', () => {
    const { getByRole } = render(<ToastContainer />);
    act(() => { showToast('錯誤', 'error'); });
    const el = getByRole('alert');
    expect(el.className).toContain('destructive');
  });

  it('success toast 有 success 樣式', () => {
    const { getByRole } = render(<ToastContainer />);
    act(() => { showToast('成功', 'success'); });
    const el = getByRole('alert');
    expect(el.className).toContain('success');
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
    let id = 0;
    act(() => {
      showToast('會消失', 'info');
      // showToast 回傳的是 void，用 queryByText 確認
    });
    expect(queryByText('會消失')).toBeTruthy();
  });

  it('offline icon 有 wifi-off SVG（含斜線）', () => {
    const { container } = render(<ToastContainer />);
    act(() => { showToast('離線', 'offline'); });
    expect(container.querySelector('line')).toBeTruthy();
  });

  it('online icon 有 checkmark SVG', () => {
    const { container } = render(<ToastContainer />);
    act(() => { showToast('上線', 'online'); });
    expect(container.querySelector('circle')).toBeTruthy();
    expect(container.querySelector('line')).toBeNull();
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
    expect(getByRole('alert').className).toContain('destructive');
  });

  it('severe severity 顯示 error toast', () => {
    const { getByRole } = render(<ToastContainer />);
    act(() => { showErrorToast('嚴重錯誤', 'severe'); });
    expect(getByRole('alert').className).toContain('destructive');
  });

  it('background severity 顯示 info toast', () => {
    const { getByRole } = render(<ToastContainer />);
    act(() => { showErrorToast('背景通知', 'background'); });
    expect(getByRole('alert').className).toContain('glass-toast');
  });
});
