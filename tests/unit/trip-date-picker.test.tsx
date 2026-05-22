/**
 * TripDatePicker — terracotta-themed date picker (replaces native type="date").
 *
 * Covers:
 *   - Trigger renders placeholder when no value
 *   - Trigger shows formatted date when value present
 *   - Popover toggles open/close on button click
 *   - Outside click closes the popover
 *   - Selecting a day triggers onChange with ISO string + closes popover
 *   - Disabled state prevents popover from opening
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TripDatePicker } from '../../src/components/TripDatePicker';

describe('TripDatePicker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders placeholder text when value is empty', () => {
    render(<TripDatePicker value="" onChange={() => {}} placeholder="選擇日期" />);
    expect(screen.getByRole('button')).toHaveTextContent('選擇日期');
  });

  it('shows ISO date string in trigger when value is set', () => {
    render(<TripDatePicker value="2026-05-22" onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('2026-05-22');
  });

  it('opens popover when trigger clicked', () => {
    render(<TripDatePicker value="2026-05-22" onChange={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes popover on outside click', () => {
    render(
      <div>
        <TripDatePicker value="2026-05-22" onChange={() => {}} />
        <div data-testid="outside">outside</div>
      </div>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onChange with selected day and closes popover', () => {
    const onChange = vi.fn();
    render(<TripDatePicker value="2026-05-15" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    const dayButtons = screen
      .getAllByRole('gridcell')
      .map((cell) => cell.querySelector('button'))
      .filter((b): b is HTMLButtonElement => b !== null && !!b.textContent && /^\d+$/.test(b.textContent));
    const target = dayButtons.find((b) => b.textContent === '22');
    expect(target).toBeTruthy();
    fireEvent.click(target!);
    expect(onChange).toHaveBeenCalledWith('2026-05-22');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not open popover when disabled', () => {
    render(<TripDatePicker value="2026-05-22" onChange={() => {}} disabled />);
    const trigger = screen.getByRole('button');
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
