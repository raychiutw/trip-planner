/**
 * confirm-modal-a11y.test.tsx — v2.33.45 round 6b test gap fill
 *
 * ConfirmModal 用於 destructive flow（刪除 trip / 移除共編 / 撤回邀請）。
 * a11y regression 會擋住 keyboard user — 之前 zero coverage，本 spec 守住：
 *   - portal mount + open/closed state
 *   - confirm button auto-focus 進 modal
 *   - Escape 觸發 onCancel
 *   - backdrop click 觸發 onCancel
 *   - confirm button click → onConfirm
 *   - busy state disable confirm
 *   - warning prop conditional render
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';
import ConfirmModal from '../../src/components/shared/ConfirmModal';

afterEach(() => cleanup());

describe('ConfirmModal — a11y + interaction', () => {
  it('open=false 不 render', () => {
    render(
      <ConfirmModal
        open={false}
        title="刪除行程"
        message="此動作無法復原"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText('刪除行程')).not.toBeInTheDocument();
  });

  it('open=true → portal 渲染 + 自動 focus 安全（取消）button（W12 HIG 破壞性動作預設焦點）', async () => {
    render(
      <ConfirmModal
        open={true}
        title="刪除行程"
        message="此動作無法復原"
        confirmLabel="刪除"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('刪除行程')).toBeInTheDocument();
    // W12：預設焦點在安全（取消）鈕、非破壞（刪除）鈕 —— keyboard user 按 Enter 不會直接刪除。
    const cancelBtn = screen.getByRole('button', { name: '取消' });
    // 引擎在 requestAnimationFrame 內 focus initialFocusRef（cancel 鈕），故 await
    await waitFor(() => expect(document.activeElement).toBe(cancelBtn));
  });

  it('backdrop 使用全域 modal z-index token，壓過地圖與 sticky chrome', () => {
    render(
      <ConfirmModal
        open={true}
        title="刪除行程"
        message="此動作無法復原"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const styleText = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .join('\n');
    expect(styleText).toContain('z-index: var(--z-modal, 9000)');
  });

  it('Escape 觸發 onCancel', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        open={true}
        title="t"
        message="m"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('backdrop click 觸發 onCancel', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        open={true}
        title="t"
        message="m"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('confirm-modal-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Confirm button click → onConfirm', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        open={true}
        title="t"
        message="m"
        confirmLabel="刪除"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '刪除' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('busy=true → confirm button disabled + 顯「處理中…」', () => {
    render(
      <ConfirmModal
        open={true}
        title="t"
        message="m"
        confirmLabel="刪除"
        busy={true}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: '處理中…' });
    expect(confirmBtn).toBeDisabled();
  });

  it('warning prop → 紅色警告 block', () => {
    render(
      <ConfirmModal
        open={true}
        title="t"
        message="m"
        warning="此操作會清空 7 天行程內容"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('此操作會清空 7 天行程內容')).toBeInTheDocument();
  });

  it('Escape 在 open=false 時不觸發 onCancel (cleanup 正確)', () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmModal
        open={true}
        title="t"
        message="m"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    rerender(
      <ConfirmModal
        open={false}
        title="t"
        message="m"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
