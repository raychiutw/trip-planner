/**
 * Test helper — interact with TripTimePicker (button trigger + popover).
 *
 * Replaces `fireEvent.change(input, { target: { value: 'HH:MM' } })` with
 * the new pattern (click trigger to open popover, then click hour + minute
 * cells).
 *
 * W11：picker 現在「12/24 跟系統」。unit 測試環境 Node 預設 locale=en-US(hour12=true)，
 * 頁面內嵌的 picker 無法逐一傳 hour12={false}，故此 helper 依實際 render 的模式操作 ——
 * 12h 走 h12 小時 cell + AM/PM cell 組出目標 24h；24h 走原 data-h。目標值一律 24h "HH:MM"。
 */
import { fireEvent, screen } from '@testing-library/react';
import { to12h } from '../../../src/components/TripTimePicker';

export function pickTime(wrapperTestId: string, hhmm: string): void {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`pickTime: invalid HH:MM "${hhmm}"`);
  const hh = m[1]!;
  const mm = m[2]!;

  const wrapper = screen.getByTestId(wrapperTestId);
  const trigger = wrapper.querySelector<HTMLElement>('button');
  if (!trigger) throw new Error(`TripTimePicker trigger not found in testId=${wrapperTestId}`);

  const clickCell = (sel: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) throw new Error(`cell not found: ${sel}`);
    fireEvent.click(el); // 點 cell 會 onChange + 關 popover
  };

  fireEvent.click(trigger); // 開 popover
  const is12h = !!document.querySelector('[data-period]');

  if (is12h) {
    const { h12, period } = to12h(hh);
    // hour → period → minute：每步 onChange 更新 value，下一步 reopen 從新 parsed 重算 24h。
    clickCell(`[data-h="${h12}"]`);
    fireEvent.click(trigger);
    clickCell(`[data-period="${period}"]`);
    fireEvent.click(trigger);
    clickCell(`[data-m="${mm}"]`);
  } else {
    clickCell(`[data-h="${hh}"]`);
    fireEvent.click(trigger);
    clickCell(`[data-m="${mm}"]`);
  }
}
