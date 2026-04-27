/**
 * UndoToast — drag 完成後 5 秒 revert 視窗 unit tests。
 *
 * Spec scenarios（drag-to-promote spec）:
 *   - "5 秒內點 toast undo → 系統 DELETE 新 entry + 清 promoted_to_entry_id"
 *   - "5 秒後 toast 自動消失 → drag 結果為最終狀態，無 undo 選項"
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import UndoToast from '../../src/components/trip/UndoToast';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UndoToast', () => {
  it('renders message + undo button when open', () => {
    render(
      <UndoToast open message="已加入 Day 2" onUndo={vi.fn()} onTimeout={vi.fn()} />,
    );
    expect(screen.getByTestId('undo-toast').textContent).toContain('已加入 Day 2');
    expect(screen.getByTestId('undo-toast-action')).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    render(
      <UndoToast open={false} message="x" onUndo={vi.fn()} onTimeout={vi.fn()} />,
    );
    expect(screen.queryByTestId('undo-toast')).toBeNull();
  });

  it('clicking undo fires onUndo callback', () => {
    const onUndo = vi.fn();
    render(
      <UndoToast open message="x" onUndo={onUndo} onTimeout={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('undo-toast-action'));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('fires onTimeout after default 5 seconds', () => {
    const onTimeout = vi.fn();
    render(
      <UndoToast open message="x" onUndo={vi.fn()} onTimeout={onTimeout} />,
    );
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(4999); });
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('honors custom durationMs', () => {
    const onTimeout = vi.fn();
    render(
      <UndoToast open message="x" durationMs={2000} onUndo={vi.fn()} onTimeout={onTimeout} />,
    );
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('does not fire onTimeout if closed before duration elapses', () => {
    const onTimeout = vi.fn();
    const { rerender } = render(
      <UndoToast open message="x" onUndo={vi.fn()} onTimeout={onTimeout} />,
    );
    rerender(<UndoToast open={false} message="x" onUndo={vi.fn()} onTimeout={onTimeout} />);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('resets countdown when resetKey changes (new drag event re-arms toast)', () => {
    const onTimeout = vi.fn();
    const { rerender } = render(
      <UndoToast open message="x" onUndo={vi.fn()} onTimeout={onTimeout} resetKey={1} />,
    );
    act(() => { vi.advanceTimersByTime(4000); });
    rerender(<UndoToast open message="y" onUndo={vi.fn()} onTimeout={onTimeout} resetKey={2} />);
    act(() => { vi.advanceTimersByTime(4999); });
    expect(onTimeout).not.toHaveBeenCalled(); // first timer cancelled, second 還沒到 5000
    act(() => { vi.advanceTimersByTime(1); });
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('uses role=status + aria-live=polite for screen reader announcement', () => {
    render(
      <UndoToast open message="x" onUndo={vi.fn()} onTimeout={vi.fn()} />,
    );
    const toast = screen.getByTestId('undo-toast');
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
  });
});
