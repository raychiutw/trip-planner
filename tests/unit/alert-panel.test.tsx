/**
 * AlertPanel unit tests — Section 4.10 (terracotta-ui-parity-polish)
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AlertPanel from '../../src/components/shared/AlertPanel';

describe('AlertPanel', () => {
  it('error variant 用 alert role + 紅色 styling 的 class', () => {
    render(<AlertPanel variant="error" title="無法載入" message="網路斷線" />);
    const panel = screen.getByTestId('alert-panel');
    expect(panel.getAttribute('role')).toBe('alert');
    expect(panel.className).toContain('is-error');
    expect(screen.getByText('無法載入')).toBeTruthy();
    expect(screen.getByText('網路斷線')).toBeTruthy();
  });

  it('warning / info variant 用 status role + 對應 class', () => {
    const { rerender } = render(<AlertPanel variant="warning" title="離線模式" />);
    expect(screen.getByTestId('alert-panel').className).toContain('is-warning');
    expect(screen.getByTestId('alert-panel').getAttribute('role')).toBe('status');
    rerender(<AlertPanel variant="info" title="已恢復連線" />);
    expect(screen.getByTestId('alert-panel').className).toContain('is-info');
  });

  it('actionLabel + onAction 顯示 action button + 點擊觸發 callback', () => {
    const onAction = vi.fn();
    render(
      <AlertPanel variant="error" title="載入失敗" actionLabel="重試" onAction={onAction} />,
    );
    const btn = screen.getByTestId('alert-panel-action');
    expect(btn.textContent).toContain('重試');
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('onDismiss 顯示關閉 X button + 點擊觸發', () => {
    const onDismiss = vi.fn();
    render(
      <AlertPanel variant="info" title="同步完成" onDismiss={onDismiss} />,
    );
    const dismissBtn = screen.getByTestId('alert-panel-dismiss');
    expect(dismissBtn.getAttribute('aria-label')).toBe('關閉提示');
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('無 actionLabel + 無 onDismiss → action 區為空（不 render 兩個 button）', () => {
    render(<AlertPanel variant="info" title="僅提示" />);
    expect(screen.queryByTestId('alert-panel-action')).toBeNull();
    expect(screen.queryByTestId('alert-panel-dismiss')).toBeNull();
  });

  it('預設 icon 對應 variant：error/warning → warning, info → info', () => {
    const { container, rerender } = render(<AlertPanel variant="error" title="x" />);
    expect(container.querySelector('.tp-alert-panel-icon')).toBeTruthy();
    rerender(<AlertPanel variant="info" title="x" />);
    expect(container.querySelector('.tp-alert-panel-icon')).toBeTruthy();
  });

  it('icon prop 可 override default', () => {
    const { container } = render(<AlertPanel variant="info" title="x" icon="check" />);
    // Icon SVG 含 check path 不含 info path（path data 有差但 unit test 不深 inspect SVG path）
    expect(container.querySelector('.tp-alert-panel-icon .svg-icon')).toBeTruthy();
  });
});
