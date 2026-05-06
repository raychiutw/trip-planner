/**
 * MapSkeleton contract tests:
 *   - Renders with default text "載入地圖中…"
 *   - Custom text override works
 *   - role="status" + aria-live="polite" + aria-label = text
 *   - 含 .tp-map-skeleton + .tp-map-skeleton-spinner subelements
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MapSkeleton from '../../src/components/trip/MapSkeleton';

describe('MapSkeleton', () => {
  it('default text "載入地圖中…"', () => {
    render(<MapSkeleton />);
    const skel = screen.getByTestId('map-skeleton');
    expect(skel.textContent).toContain('載入地圖中');
  });

  it('custom text override', () => {
    render(<MapSkeleton text="正在切換地圖…" />);
    expect(screen.getByTestId('map-skeleton').textContent).toContain('正在切換地圖');
  });

  it('a11y attrs: role=status + aria-live=polite + aria-label = text', () => {
    render(<MapSkeleton text="載入地圖中…" />);
    const skel = screen.getByTestId('map-skeleton');
    expect(skel.getAttribute('role')).toBe('status');
    expect(skel.getAttribute('aria-live')).toBe('polite');
    expect(skel.getAttribute('aria-label')).toBe('載入地圖中…');
  });

  it('spinner subelement present (decorative)', () => {
    render(<MapSkeleton />);
    const spinner = screen.getByTestId('map-skeleton').querySelector('.tp-map-skeleton-spinner');
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute('aria-hidden')).toBe('true');
  });
});
