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
  fireEvent.click(trigger);

  const hourCell = document.querySelector<HTMLElement>(`[data-h="${hh}"]`);
  const minuteCell = document.querySelector<HTMLElement>(`[data-m="${mm}"]`);
  if (!hourCell) throw new Error(`hour cell ${hh} not found`);
  if (!minuteCell) throw new Error(`minute cell ${mm} not found (check minuteStep)`);

  fireEvent.click(hourCell);
  // After hour click popover closes; reopen to set minute.
  fireEvent.click(trigger);
  fireEvent.click(document.querySelector<HTMLElement>(`[data-m="${mm}"]`)!);
}
