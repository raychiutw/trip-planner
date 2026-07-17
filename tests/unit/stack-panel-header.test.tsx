/**
 * StackPanelHeader — rev2 共用堆疊面板 header（‹ 前一頁 / ✕ 整個關閉）。
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import StackPanelHeader from '../../src/components/shell/StackPanelHeader';

describe('StackPanelHeader — rev2 共用堆疊面板 header', () => {
  it('有 onBack → 顯示「‹」返上一層 + ✕ 關閉，各自觸發 callback', () => {
    const onBack = vi.fn();
    const onClose = vi.fn();
    const { getByTestId } = render(<StackPanelHeader title="清水寺" onBack={onBack} onClose={onClose} />);
    const back = getByTestId('stack-panel-back') as HTMLButtonElement;
    const close = getByTestId('stack-panel-close') as HTMLButtonElement;
    back.click();
    close.click();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('L2 modal（無 onBack）→ 只有 ✕ 關閉，無 back', () => {
    const { getByTestId, queryByTestId } = render(<StackPanelHeader onClose={() => {}} />);
    expect(queryByTestId('stack-panel-back')).toBeNull();
    expect(getByTestId('stack-panel-close')).not.toBeNull();
  });

  it('title + back/close aria-label', () => {
    const { getByTestId, getByLabelText } = render(
      <StackPanelHeader title="換景點" onBack={() => {}} onClose={() => {}} />,
    );
    expect(getByTestId('stack-panel-header').textContent).toContain('換景點');
    expect(getByLabelText('返回上一層')).not.toBeNull();
    expect(getByLabelText('關閉')).not.toBeNull();
  });
});
