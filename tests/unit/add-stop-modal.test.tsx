/**
 * AddStopModal unit test — Section 3 (terracotta-add-stop-modal)
 *
 * 驗 modal core flow：
 *   - open=false 不 render
 *   - open=true render modal + 3 tabs + footer
 *   - tab switch 改 body 內容
 *   - 自訂 tab form 缺 title 顯示 inline error
 *   - footer counter 隨 selection 更新
 *   - close button + Esc + backdrop click 關閉
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AddStopModal from '../../src/components/trip/AddStopModal';

const baseProps = {
  tripId: 'okinawa',
  dayNum: 3,
  dayLabel: 'Day 3 · 7/28',
  onClose: vi.fn(),
};

describe('AddStopModal', () => {
  it('open=false 不 render', () => {
    render(<AddStopModal {...baseProps} open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('add-stop-modal')).toBeNull();
  });

  it('open=true render modal + dayLabel + 3 tabs', () => {
    render(<AddStopModal {...baseProps} open onClose={vi.fn()} />);
    expect(screen.getByTestId('add-stop-modal')).toBeTruthy();
    expect(screen.getByText('Day 3 · 7/28')).toBeTruthy();
    expect(screen.getByTestId('add-stop-tab-search')).toBeTruthy();
    expect(screen.getByTestId('add-stop-tab-saved')).toBeTruthy();
    expect(screen.getByTestId('add-stop-tab-custom')).toBeTruthy();
  });

  it('預設選 search tab，切到 custom tab 後顯示 form', () => {
    render(<AddStopModal {...baseProps} open onClose={vi.fn()} />);
    expect(screen.getByTestId('add-stop-search-input')).toBeTruthy();
    fireEvent.click(screen.getByTestId('add-stop-tab-custom'));
    expect(screen.getByTestId('add-stop-custom-title')).toBeTruthy();
    expect(screen.queryByTestId('add-stop-search-input')).toBeNull();
  });

  it('自訂 tab 缺 title 點完成 → inline error 顯示', async () => {
    render(<AddStopModal {...baseProps} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('add-stop-tab-custom'));
    // 沒填 title 直接點完成
    fireEvent.click(screen.getByTestId('add-stop-confirm'));
    expect(screen.getByTestId('add-stop-custom-error').textContent).toContain('請輸入');
  });

  it('自訂 tab 填 title → confirm button enabled + counter 為 1', () => {
    render(<AddStopModal {...baseProps} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('add-stop-tab-custom'));
    fireEvent.change(screen.getByTestId('add-stop-custom-title'), { target: { value: '海邊散步' } });
    expect(screen.getByTestId('add-stop-counter').textContent).toContain('1');
    expect((screen.getByTestId('add-stop-confirm') as HTMLButtonElement).disabled).toBe(false);
  });

  it('close button → onClose called', () => {
    const onClose = vi.fn();
    render(<AddStopModal {...baseProps} open onClose={onClose} />);
    fireEvent.click(screen.getByTestId('add-stop-modal-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cancel button → onClose called', () => {
    const onClose = vi.fn();
    render(<AddStopModal {...baseProps} open onClose={onClose} />);
    fireEvent.click(screen.getByTestId('add-stop-cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Esc key → onClose called', () => {
    const onClose = vi.fn();
    render(<AddStopModal {...baseProps} open onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('backdrop click → onClose called', () => {
    const onClose = vi.fn();
    render(<AddStopModal {...baseProps} open onClose={onClose} />);
    const backdrop = screen.getByTestId('add-stop-modal-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('search tab + 0 selected → confirm button disabled', () => {
    render(<AddStopModal {...baseProps} open onClose={vi.fn()} />);
    // 預設 search tab + 沒選 → disabled
    expect((screen.getByTestId('add-stop-confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('custom tab + 空 title → confirm button enabled (允許 click 觸發 inline error)', () => {
    render(<AddStopModal {...baseProps} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('add-stop-tab-custom'));
    expect((screen.getByTestId('add-stop-confirm') as HTMLButtonElement).disabled).toBe(false);
  });

  it('dayLabel 預設 fallback 「Day N」', () => {
    render(<AddStopModal tripId="x" dayNum={5} open onClose={vi.fn()} />);
    expect(screen.getByText('Day 5')).toBeTruthy();
  });
});
