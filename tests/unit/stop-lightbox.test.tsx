/**
 * StopLightbox — V3 mockup ⛶ 放大檢視 fullscreen detail view (PR3 v2.9).
 *
 * Pure UI scaffolding. Photo carousel area is placeholder until
 * entries/pois schema gains photo storage. Read-only display of existing
 * description / note / location / timing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StopLightbox from '../../src/components/trip/StopLightbox';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';

const ENTRY: TimelineEntryData = {
  id: 42,
  time: '11:30-14:00',
  title: '沖縄美ら海水族館',
  description: '世界第二大水族館，鎮館之寶是黑潮之海。',
  note: '提前線上買票省 ¥120。',
  googleRating: 4.6,
  locations: [{ name: '沖繩美ら海水族館', label: '本部町石川 424', googleQuery: '沖縄美ら海水族館' }],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StopLightbox — open / close', () => {
  it('returns null when closed', () => {
    const { container } = render(<StopLightbox open={false} entry={ENTRY} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when open', () => {
    render(<StopLightbox open entry={ENTRY} onClose={() => {}} />);
    expect(screen.getByTestId('stop-lightbox')).toBeTruthy();
  });

  it('shows title, description, note, time, location', () => {
    render(<StopLightbox open entry={ENTRY} onClose={() => {}} />);
    const lb = screen.getByTestId('stop-lightbox');
    expect(lb.textContent).toContain('沖縄美ら海水族館');
    expect(lb.textContent).toContain('世界第二大水族館');
    expect(lb.textContent).toContain('提前線上買票省 ¥120');
    expect(lb.textContent).toContain('11:30');
    expect(lb.textContent).toContain('14:00');
    expect(lb.textContent).toContain('本部町石川 424');
    expect(lb.textContent).toContain('★ 4.6');
  });

  it('shows photo placeholder with "即將推出" hint', () => {
    render(<StopLightbox open entry={ENTRY} onClose={() => {}} />);
    expect(screen.getByTestId('stop-lightbox-photo-placeholder').textContent).toContain('即將推出');
  });

  it('calls onClose when ✕ button clicked', () => {
    const onClose = vi.fn();
    render(<StopLightbox open entry={ENTRY} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('stop-lightbox-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on ESC key', () => {
    const onClose = vi.fn();
    render(<StopLightbox open entry={ENTRY} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking backdrop closes', () => {
    const onClose = vi.fn();
    render(<StopLightbox open entry={ENTRY} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByTestId('stop-lightbox'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking inside content does NOT close', () => {
    const onClose = vi.fn();
    render(<StopLightbox open entry={ENTRY} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByTestId('stop-lightbox-content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handles entry without locations gracefully', () => {
    render(<StopLightbox open entry={{ ...ENTRY, locations: null }} onClose={() => {}} />);
    expect(screen.getByTestId('stop-lightbox')).toBeTruthy();
  });
});
