/**
 * useSheetBehavior — 統一 sheet/modal 行為引擎（rev2 HIG 收斂 B0）。
 *
 * 既有：container class、body scroll lock、focus、Escape、focus trap、backdrop scroll。
 * B0 新增（eng review F6/F7/F10/F11/F12）：
 *   - initialFocusRef：開啟時 focus 指定元素（如 confirm 鈕），非 panel 容器。
 *   - canDismiss=false：busy（送出中）鎖 Escape。
 *   - modal=false：非 modal 面板（桌機右欄）不鎖 body scroll。
 *   - 巢狀時只有最上層 sheet 回應 Escape（module-level registry）。
 */
import { describe, it, expect, vi } from 'vitest';
import { useRef } from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { useSheetBehavior } from '../../src/hooks/useSheetBehavior';

function Sheet({
  open,
  onClose,
  useInitialFocus = false,
  canDismiss,
  modal,
  testid = 'panel',
}: {
  open: boolean;
  onClose: () => void;
  useInitialFocus?: boolean;
  canDismiss?: boolean;
  modal?: boolean;
  testid?: string;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const { panelRef, backdropRef, handlePanelKeyDown } = useSheetBehavior(open, onClose, {
    initialFocusRef: useInitialFocus ? confirmRef : undefined,
    canDismiss,
    modal,
  });
  if (!open) return null;
  return (
    <div>
      <div ref={backdropRef} data-testid={`${testid}-backdrop`} />
      <div ref={panelRef} tabIndex={-1} data-testid={testid} onKeyDown={handlePanelKeyDown}>
        <button ref={confirmRef} data-testid={`${testid}-confirm`}>OK</button>
      </div>
    </div>
  );
}

describe('useSheetBehavior — B0 引擎新增行為', () => {
  it('initialFocusRef：開啟時 focus 指定元素（非 panel 容器）', async () => {
    const { getByTestId } = render(<Sheet open onClose={() => {}} useInitialFocus />);
    await waitFor(() => expect(document.activeElement).toBe(getByTestId('panel-confirm')));
    cleanup();
  });

  it('canDismiss=false：Escape 不關（busy 送出中鎖）', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} canDismiss={false} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    cleanup();
  });

  it('canDismiss 預設 true：Escape 正常關（既有行為不變）', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('modal=false：不鎖 body scroll（桌機非 modal 右欄面板）', () => {
    render(<Sheet open onClose={() => {}} modal={false} />);
    expect(document.body.style.position).not.toBe('fixed');
    cleanup();
  });

  it('modal 預設 true：鎖 body scroll（既有 InfoSheet 行為）', () => {
    render(<Sheet open onClose={() => {}} />);
    expect(document.body.style.position).toBe('fixed');
    cleanup();
  });

  it('巢狀：兩層開啟，Escape 只關最上層（registry topmost）', () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    render(
      <>
        <Sheet open onClose={closeOuter} testid="outer" />
        <Sheet open onClose={closeInner} testid="inner" />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    // inner 後掛載 = topmost → 只有它關
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
    cleanup();
  });
});
