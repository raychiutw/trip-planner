/**
 * Test helper — interact with TripTimePicker (button trigger + popover).
 *
 * Replaces `fireEvent.change(input, { target: { value: 'HH:MM' } })` with
 * the new pattern (click trigger to open popover, then click hour + minute
 * cells).
 */
import { fireEvent, screen } from '@testing-library/react';

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
  clickCell(`[data-h="${hh}"]`);
  fireEvent.click(trigger);
  clickCell(`[data-m="${mm}"]`);
}
