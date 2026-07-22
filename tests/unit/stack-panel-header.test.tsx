/**
 * StackPanelHeader — rev2 共用堆疊面板 header（‹ 前一頁 / ✕ 整個關閉）。
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import StackPanelHeader, { STACK_PANEL_HEADER_STYLES } from '../../src/components/shell/StackPanelHeader';

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

  // G-H6a（HIG 44pt hit target）：‹/✕ 是全 6 個操作頁共用的主控件，
  // 舊值 38×38 低於 Apple HIG 最小觸控區。改用 --spacing-tap-min（44px）。
  it('G-H6a: ‹/✕ 觸控區用 --spacing-tap-min（44pt），不再是 38px', () => {
    expect(STACK_PANEL_HEADER_STYLES).not.toContain('38px');
    // 按鈕與佔位 spacer 都須用 tap-min token
    expect(STACK_PANEL_HEADER_STYLES).toMatch(
      /\.tp-stack-head-btn\s*\{[^}]*var\(--spacing-tap-min\)/,
    );
    expect(STACK_PANEL_HEADER_STYLES).toMatch(
      /\.tp-stack-head-spacer\s*\{[^}]*var\(--spacing-tap-min\)/,
    );
  });

  // owner 2026-07-21（第二輪回報 #3）：第三欄 StackPanelHeader 沒有跟中欄 TitleBar
  // 等高 —— TitleBar 用 --titlebar-h token（64px 桌機/56px compact），StackPanelHeader
  // 寫死 52px，兩欄 header 對不齊。改共用同一個 token 來源。
  it('owner 回報 #3：.tp-stack-head 高度改用 --titlebar-h token（不再寫死 52px），跟 .tp-titlebar 同一個高度來源', () => {
    expect(STACK_PANEL_HEADER_STYLES).not.toMatch(/\.tp-stack-head\s*\{[^}]*height:\s*52px/);
    expect(STACK_PANEL_HEADER_STYLES).toMatch(
      /\.tp-stack-head\s*\{[^}]*height:\s*calc\(var\(--titlebar-h\)/,
    );
  });
});
