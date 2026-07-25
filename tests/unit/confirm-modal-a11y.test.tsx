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

describe('ConfirmModal — 關閉後焦點回到觸發元素（#1160）', () => {
  /**
   * 鍵盤使用者關掉對話框後不該被丟回文件頂端、重新 Tab 一遍才回到原位。
   *
   * 引擎（useSheetBehavior）本來就有焦點還原機制，但要靠呼叫方傳 `restorePreviousFocus`
   * 或 `triggerRef` 才會啟動 —— 而三個共用對話框（ConfirmModal / InputModal /
   * ConflictModal，共 26 處 JSX 使用）**都只傳 initialFocusRef**，兩個都沒傳，
   * 所以全部沒有還原。#1160 改的是引擎的**預設值**：兩者都沒給時仍記住開啟當下的
   * document.activeElement 並在關閉時聚焦回去，不必去改 26 個呼叫點。
   */
  function Harness({ open }: { open: boolean }) {
    return (
      <>
        <button type="button" data-testid="trigger">開啟</button>
        <ConfirmModal
          open={open}
          title="刪除行程"
          message="此動作無法復原"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </>
    );
  }

  it('開啟前聚焦某按鈕 → 開對話框 → 關閉 → 焦點回到該按鈕', async () => {
    const { rerender } = render(<Harness open={false} />);
    const trigger = screen.getByTestId('trigger') as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    rerender(<Harness open={true} />);
    // 開啟後焦點進到對話框內的安全鈕（既有 W12 行為，不該被本票改動）。
    const cancelBtn = screen.getByRole('button', { name: '取消' });
    await waitFor(() => expect(document.activeElement).toBe(cancelBtn));

    rerender(<Harness open={false} />);
    // 關閉後回到觸發元素 —— 這是 #1160 要補的行為。
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('觸發元素在對話框開啟期間被移除 → 不 throw、也不亂搶焦點', async () => {
    // 真實情境：刪除流程關掉對話框時，觸發它的那一列已經連帶消失。
    function Vanishing({ open, withTrigger }: { open: boolean; withTrigger: boolean }) {
      return (
        <>
          {withTrigger && <button type="button" data-testid="trigger">開啟</button>}
          <ConfirmModal open={open} title="t" message="m" onConfirm={() => {}} onCancel={() => {}} />
        </>
      );
    }
    const { rerender } = render(<Vanishing open={false} withTrigger />);
    (screen.getByTestId('trigger') as HTMLButtonElement).focus();
    rerender(<Vanishing open={true} withTrigger />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '取消' })));
    // 觸發元素與對話框同時消失
    expect(() => rerender(<Vanishing open={false} withTrigger={false} />)).not.toThrow();
  });
});
