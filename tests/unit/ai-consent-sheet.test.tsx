/**
 * AiConsentSheet — ChatPage 送出時「owner 未授權 AI」的底部授權 sheet（sign-off variant B）。鎖：
 *   - open=false → 不渲染
 *   - open=true → 顯訊息引用 + 授權/取消鈕 + fineprint
 *   - 點授權 → onAuthorizeAndSend；點取消 / Escape / 點背景 → onCancel
 *   - busy → 授權鈕 disabled + 顯「授權中」、點背景不觸發 onCancel（防誤取消進行中授權）
 *   - error → 顯錯誤訊息
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AiConsentSheet from '../../src/components/AiConsentSheet';

function setup(overrides: Partial<React.ComponentProps<typeof AiConsentSheet>> = {}) {
  const onAuthorizeAndSend = vi.fn();
  const onCancel = vi.fn();
  render(
    <AiConsentSheet
      open
      message="幫我排藏王三天兩夜"
      onAuthorizeAndSend={onAuthorizeAndSend}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onAuthorizeAndSend, onCancel };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('AiConsentSheet', () => {
  it('open=false → 不渲染', () => {
    const onAuthorizeAndSend = vi.fn();
    const onCancel = vi.fn();
    render(
      <AiConsentSheet open={false} message="x" onAuthorizeAndSend={onAuthorizeAndSend} onCancel={onCancel} />,
    );
    expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
  });

  it('open → 顯訊息引用 + 授權/取消鈕 + fineprint', () => {
    setup();
    expect(screen.getByTestId('ai-consent-sheet')).toBeTruthy();
    expect(screen.getByTestId('ai-consent-quoted').textContent).toContain('幫我排藏王三天兩夜');
    expect(screen.getByTestId('ai-consent-authorize').textContent).toContain('授權並送出');
    expect(screen.getByTestId('ai-consent-cancel').textContent).toContain('取消');
    expect(screen.getByText('授權對象：Tripline AI 行程排程')).toBeTruthy();
  });

  it('點授權 → onAuthorizeAndSend', () => {
    const { onAuthorizeAndSend } = setup();
    fireEvent.click(screen.getByTestId('ai-consent-authorize'));
    expect(onAuthorizeAndSend).toHaveBeenCalledTimes(1);
  });

  it('點取消 → onCancel', () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByTestId('ai-consent-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape → onCancel', () => {
    const { onCancel } = setup();
    // 統一引擎在 document 上聽 keydown（非 window）
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('點背景 → onCancel', () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByTestId('ai-consent-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('點 sheet 本體不冒泡到背景（不誤觸 onCancel）', () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByTestId('ai-consent-sheet'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('busy → 授權鈕 disabled + 顯「授權中」，點背景不觸發 onCancel', () => {
    const { onCancel } = setup({ busy: true });
    const btn = screen.getByTestId('ai-consent-authorize') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('授權中');
    fireEvent.click(screen.getByTestId('ai-consent-backdrop'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('busy → Escape 不觸發 onCancel（防看似取消卻仍在送出）', () => {
    const { onCancel } = setup({ busy: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('error → 顯錯誤訊息', () => {
    setup({ error: '授權失敗，請稍後再試。' });
    expect(screen.getByTestId('ai-consent-error').textContent).toContain('授權失敗');
  });
});
