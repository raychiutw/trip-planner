import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CategoryPicker } from '../../src/components/trip/CategoryPicker';
import { POI_TYPE_LABELS } from '../../src/lib/poiCategory';

describe('CategoryPicker (Variant C icon grid — signed off 2026-06-04)', () => {
  it('renders all 8 whitelist categories as radios with zh-TW labels', () => {
    render(<CategoryPicker value="attraction" onChange={() => {}} />);
    expect(screen.getAllByRole('radio')).toHaveLength(8);
    for (const label of Object.values(POI_TYPE_LABELS)) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('marks the current value as aria-checked', () => {
    render(<CategoryPicker value="restaurant" onChange={() => {}} testIdPrefix="cp" />);
    expect(screen.getByTestId('cp-restaurant').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('cp-hotel').getAttribute('aria-checked')).toBe('false');
  });

  it('calls onChange with the clicked category (override)', () => {
    const onChange = vi.fn();
    render(<CategoryPicker value="attraction" onChange={onChange} testIdPrefix="cp" />);
    fireEvent.click(screen.getByTestId('cp-transport'));
    expect(onChange).toHaveBeenCalledWith('transport');
  });

  it('shows the auto-derived dot indicator only on the autoValue tile', () => {
    render(
      <CategoryPicker value="attraction" onChange={() => {}} autoValue="restaurant" testIdPrefix="cp" />,
    );
    expect(screen.getByTestId('cp-restaurant').querySelector('.tp-category-tile-auto')).toBeTruthy();
    expect(screen.getByTestId('cp-attraction').querySelector('.tp-category-tile-auto')).toBeFalsy();
  });

  it('wires aria-labelledby to a visible label when provided (matches visible/accessible name)', () => {
    render(<CategoryPicker value="attraction" onChange={() => {}} ariaLabelledBy="cat-lbl" />);
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-labelledby')).toBe('cat-lbl');
    expect(group.getAttribute('aria-label')).toBeNull();
  });

  it('falls back to its own aria-label when no labelledby is given', () => {
    render(<CategoryPicker value="attraction" onChange={() => {}} />);
    expect(screen.getByRole('radiogroup').getAttribute('aria-label')).toBe('景點類別');
  });
});
