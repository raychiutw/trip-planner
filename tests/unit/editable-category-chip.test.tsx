import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EditableCategoryChip } from '../../src/components/trip/EditableCategoryChip';

describe('EditableCategoryChip', () => {
  it('renders the current category as a chip (label + edit affordance)', () => {
    render(<EditableCategoryChip value="restaurant" onChange={() => {}} testIdPrefix="ec" />);
    expect(screen.getByText('餐廳')).toBeTruthy();
    // picker is collapsed until the chip is clicked
    expect(screen.queryByTestId('ec-pop')).toBeNull();
  });

  it('opens the picker on click, calls onChange with the picked type, and closes', () => {
    const onChange = vi.fn();
    render(<EditableCategoryChip value="attraction" onChange={onChange} testIdPrefix="ec" />);
    fireEvent.click(screen.getByTestId('ec-toggle'));
    expect(screen.getByTestId('ec-pop')).toBeTruthy();
    expect(screen.getByTestId('ec-toggle').getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByTestId('ec-picker-restaurant'));
    expect(onChange).toHaveBeenCalledWith('restaurant');
    expect(screen.queryByTestId('ec-pop')).toBeNull(); // closed after selecting
  });

  it('does not open when disabled', () => {
    render(<EditableCategoryChip value="hotel" onChange={() => {}} disabled testIdPrefix="ec" />);
    fireEvent.click(screen.getByTestId('ec-toggle'));
    expect(screen.queryByTestId('ec-pop')).toBeNull();
  });

  it('marks the auto-derived value with the picker dot when autoValue is passed through', () => {
    render(
      <EditableCategoryChip value="attraction" onChange={() => {}} autoValue="restaurant" testIdPrefix="ec" />,
    );
    fireEvent.click(screen.getByTestId('ec-toggle'));
    expect(screen.getByTestId('ec-picker-restaurant').querySelector('.tp-category-tile-auto')).toBeTruthy();
  });
});
