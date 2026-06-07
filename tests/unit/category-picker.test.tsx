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

  // v2.50.x desktop RWD: column count follows container width instead of a fixed 4
  // (寬桌機容器原本把 4 欄撐到 ~160px，icon 周圍鬆散). auto-fit lets a wide form / popover
  // lay all 8 tiles in one row, while a narrow phone reflows to 4-5.
  it('uses a responsive auto-fit grid (no hard-coded 4-column track)', () => {
    const { container } = render(<CategoryPicker value="attraction" onChange={() => {}} />);
    const css = container.querySelector('style')?.textContent ?? '';
    expect(css).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/);
    // the old fixed 4-column track must be gone so it can never pin to 4 on desktop
    expect(css).not.toMatch(/grid-template-columns:\s*repeat\(4,/);
  });

  // v2.54.2 三色 legend: each tile carries its category's tone so the selected
  // highlight matches the timeline card colour (玩/看/買=柔褐、住/移動=sage、吃=粉).
  it('tags each tile with its category tone (picker = three-colour legend)', () => {
    render(<CategoryPicker value="attraction" onChange={() => {}} testIdPrefix="cp" />);
    // 吃 → pink
    expect(screen.getByTestId('cp-restaurant').getAttribute('data-tone')).toBe('pink');
    // 住 / 移動 → sage
    expect(screen.getByTestId('cp-hotel').getAttribute('data-tone')).toBe('sage');
    expect(screen.getByTestId('cp-transport').getAttribute('data-tone')).toBe('sage');
    expect(screen.getByTestId('cp-parking').getAttribute('data-tone')).toBe('sage');
    // 看 / 買 / 玩 → 柔褐 accent
    expect(screen.getByTestId('cp-attraction').getAttribute('data-tone')).toBe('accent');
    expect(screen.getByTestId('cp-shopping').getAttribute('data-tone')).toBe('accent');
    expect(screen.getByTestId('cp-activity').getAttribute('data-tone')).toBe('accent');
    // 其他 → neutral (falls back to accent highlight via var())
    expect(screen.getByTestId('cp-other').getAttribute('data-tone')).toBe('neutral');
  });

  it('drives the active highlight from the tone vars (not hard-coded accent)', () => {
    const { container } = render(<CategoryPicker value="restaurant" onChange={() => {}} />);
    const css = container.querySelector('style')?.textContent ?? '';
    // per-tone var definitions present (incl. explicit neutral so 'other' can't inherit
    // a --tone-* from a themed ancestor — must resolve to accent, not leak)
    expect(css).toMatch(/\.tp-category-tile\[data-tone="pink"\]/);
    expect(css).toMatch(/\.tp-category-tile\[data-tone="sage"\]/);
    expect(css).toMatch(/\.tp-category-tile\[data-tone="accent"\]/);
    expect(css).toMatch(/\.tp-category-tile\[data-tone="neutral"\]\s*\{[^}]*--tone:\s*var\(--color-accent\)/);
    // is-active consumes --tone-* with accent fallback
    expect(css).toMatch(/\.tp-category-tile\.is-active\s*\{[^}]*var\(--tone-subtle,/);
  });

  // v2.54.2: focus must NOT clobber the selected tone border. focus-visible uses
  // `outline` (orthogonal channel), so keyboard-focusing a selected pink/sage tile keeps
  // its tone box-shadow border instead of having it overwritten by a hard accent ring.
  it('focus ring uses outline, leaving the is-active tone box-shadow intact', () => {
    const { container } = render(<CategoryPicker value="restaurant" onChange={() => {}} />);
    const css = container.querySelector('style')?.textContent ?? '';
    expect(css).toMatch(/\.tp-category-tile:focus-visible\s*\{[^}]*outline:\s*2px solid/);
    // the old footgun: focus-visible must not set an inset box-shadow (would replace the
    // is-active tone border on the keyboard path)
    expect(css).not.toMatch(/\.tp-category-tile:focus-visible\s*\{[^}]*box-shadow:\s*inset/);
  });
});
