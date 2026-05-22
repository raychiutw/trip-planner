/**
 * TripTimePicker — terracotta-themed time picker (replaces native type="time").
 *
 * Covers:
 *   - Trigger shows placeholder when value invalid/empty
 *   - Trigger shows HH:MM when value set
 *   - Popover opens with 24 hour + minute columns (step=5 → 12 minutes)
 *   - Clicking hour cell triggers onChange with new value (minute defaults 00)
 *   - Clicking minute cell triggers onChange (hour defaults 12)
 *   - Both hour + minute cells render the existing selected as is-selected
 *   - minuteStep=15 → 4 minute options
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TripTimePicker } from '../../src/components/TripTimePicker';

describe('TripTimePicker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders placeholder when value empty', () => {
    render(<TripTimePicker value="" onChange={() => {}} placeholder="--:--" />);
    expect(screen.getByRole('button')).toHaveTextContent('--:--');
  });

  it('renders HH:MM when value set', () => {
    render(<TripTimePicker value="14:30" onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('14:30');
  });

  it('opens popover with 24 hours + 12 minute cells (step=5)', () => {
    render(<TripTimePicker value="12:00" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    const cells = document.querySelectorAll<HTMLElement>('.tp-time-cell');
    expect(cells.length).toBe(24 + 12);
    expect(document.querySelector('[data-h="00"]')).not.toBeNull();
    expect(document.querySelector('[data-h="23"]')).not.toBeNull();
    expect(document.querySelector('[data-m="00"]')).not.toBeNull();
    expect(document.querySelector('[data-m="55"]')).not.toBeNull();
  });

  it('clicking hour cell triggers onChange with new HH:MM (mm preserved)', () => {
    const onChange = vi.fn();
    render(<TripTimePicker value="12:30" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(document.querySelector('[data-h="08"]')!);
    expect(onChange).toHaveBeenCalledWith('08:30');
  });

  it('clicking minute cell preserves hour', () => {
    const onChange = vi.fn();
    render(<TripTimePicker value="09:00" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(document.querySelector('[data-m="45"]')!);
    expect(onChange).toHaveBeenCalledWith('09:45');
  });

  it('renders selected cells with is-selected class', () => {
    render(<TripTimePicker value="07:25" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(document.querySelector('[data-h="07"]')!.className).toContain('is-selected');
    expect(document.querySelector('[data-m="25"]')!.className).toContain('is-selected');
  });

  it('minuteStep=15 renders only 4 minute cells', () => {
    render(<TripTimePicker value="12:00" onChange={() => {}} minuteStep={15} />);
    fireEvent.click(screen.getByRole('button'));
    const minuteCells = document.querySelectorAll<HTMLElement>('[data-m]');
    expect(minuteCells.length).toBe(4);
    expect(document.querySelector('[data-m="45"]')).not.toBeNull();
  });

  it('clicking hour when value empty defaults minute to 00', () => {
    const onChange = vi.fn();
    render(<TripTimePicker value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(document.querySelector('[data-h="15"]')!);
    expect(onChange).toHaveBeenCalledWith('15:00');
  });
});
