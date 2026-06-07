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

  // v2.54.7 三色：chip 依其分類 value 上 data-tone（吃=粉、住/移動=sage、玩看買=柔褐）。
  it('carries data-tone matching its category (restaurant→pink, hotel→sage, attraction→accent)', () => {
    const { rerender } = render(<EditableCategoryChip value="restaurant" onChange={() => {}} testIdPrefix="ec" />);
    expect(screen.getByTestId('ec-toggle').getAttribute('data-tone')).toBe('pink');
    rerender(<EditableCategoryChip value="hotel" onChange={() => {}} testIdPrefix="ec" />);
    expect(screen.getByTestId('ec-toggle').getAttribute('data-tone')).toBe('sage');
    rerender(<EditableCategoryChip value="attraction" onChange={() => {}} testIdPrefix="ec" />);
    expect(screen.getByTestId('ec-toggle').getAttribute('data-tone')).toBe('accent');
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

  it('default popover opens downward (no is-up); dropUp opens it upward (is-up) — for fixed bottom bars', () => {
    const { rerender } = render(
      <EditableCategoryChip value="hotel" onChange={() => {}} testIdPrefix="ec" />,
    );
    fireEvent.click(screen.getByTestId('ec-toggle'));
    expect(screen.getByTestId('ec-pop').classList.contains('is-up')).toBe(false);

    rerender(<EditableCategoryChip value="hotel" onChange={() => {}} dropUp testIdPrefix="ec" />);
    expect(screen.getByTestId('ec-pop').classList.contains('is-up')).toBe(true);
  });

  // v2.50.x desktop RWD: on ≥768px the popover goes absolute with a definite width so it can
  // lay 8 categories in one row (auto-fit grid), floating instead of widening the inline-block
  // wrap — widening the wrap would shove chip-row siblings (e.g. the alternate's star-rating)
  // onto a new line. dropUp (fixed bottom-bar) chips must be EXCLUDED — they keep the .is-up
  // absolute right:0 anchor — so the wrap is tagged .is-dropup and the rule is scoped :not(.is-dropup).
  it('tags the wrap .is-dropup only in dropUp mode (so the desktop floating-popover rule skips bottom-bar chips)', () => {
    const { container, rerender } = render(
      <EditableCategoryChip value="hotel" onChange={() => {}} testIdPrefix="ec" />,
    );
    expect(container.querySelector('.tp-cat-chip-wrap')?.classList.contains('is-dropup')).toBe(false);

    rerender(<EditableCategoryChip value="hotel" onChange={() => {}} dropUp testIdPrefix="ec" />);
    expect(container.querySelector('.tp-cat-chip-wrap')?.classList.contains('is-dropup')).toBe(true);
  });

  // compact: overflow:hidden / narrow card (e.g. AddStopPage 搜尋卡 ~331px) keeps the mobile
  // in-flow popover on desktop too. Without it the absolute float would be clipped to a sliver
  // by the card's overflow:hidden — the P0 the adversarial review caught.
  it('tags the wrap .is-compact only in compact mode (skip the desktop float that overflow:hidden would clip)', () => {
    const { container, rerender } = render(
      <EditableCategoryChip value="hotel" onChange={() => {}} testIdPrefix="ec" />,
    );
    expect(container.querySelector('.tp-cat-chip-wrap')?.classList.contains('is-compact')).toBe(false);

    rerender(<EditableCategoryChip value="hotel" onChange={() => {}} compact testIdPrefix="ec" />);
    expect(container.querySelector('.tp-cat-chip-wrap')?.classList.contains('is-compact')).toBe(true);
  });

  it('scopes the desktop floating-popover rule to :not(.is-dropup):not(.is-compact)', () => {
    const { container } = render(<EditableCategoryChip value="hotel" onChange={() => {}} testIdPrefix="ec" />);
    const css = container.querySelector('style')?.textContent ?? '';
    expect(css).toMatch(/@media\s*\(min-width:\s*768px\)/);
    expect(css).toMatch(/\.tp-cat-chip-wrap:not\(\.is-dropup\):not\(\.is-compact\)/);
  });
});
