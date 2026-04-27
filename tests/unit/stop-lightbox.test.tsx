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

describe('StopLightbox — photo carousel (v2.12 Wave 3)', () => {
  const PHOTOS = [
    { url: 'https://commons.wikimedia.org/photo1.jpg', thumbUrl: 'https://commons.wikimedia.org/thumb1.jpg', caption: '黑潮之海水槽', source: 'https://commons.wikimedia.org/file1', attribution: 'CC BY-SA 4.0 · Wikimedia Commons' },
    { url: 'https://commons.wikimedia.org/photo2.jpg', caption: '美ら海水族館入口' },
    { url: 'https://commons.wikimedia.org/photo3.jpg' },
  ];

  it('renders placeholder when entry has no photos', () => {
    render(<StopLightbox open entry={{ ...ENTRY, photos: null }} onClose={() => {}} />);
    expect(screen.getByTestId('stop-lightbox-photo-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('stop-lightbox-carousel')).toBeNull();
  });

  it('renders placeholder when photos array is empty', () => {
    render(<StopLightbox open entry={{ ...ENTRY, photos: [] }} onClose={() => {}} />);
    expect(screen.getByTestId('stop-lightbox-photo-placeholder')).toBeTruthy();
  });

  it('renders carousel when entry has ≥1 photo', () => {
    render(<StopLightbox open entry={{ ...ENTRY, photos: PHOTOS }} onClose={() => {}} />);
    expect(screen.getByTestId('stop-lightbox-carousel')).toBeTruthy();
    expect(screen.queryByTestId('stop-lightbox-photo-placeholder')).toBeNull();
  });

  it('first photo shown by default with thumbUrl preferred over url', () => {
    render(<StopLightbox open entry={{ ...ENTRY, photos: PHOTOS }} onClose={() => {}} />);
    const img = screen.getByTestId('stop-lightbox-carousel').querySelector('img') as HTMLImageElement;
    expect(img.src).toContain('thumb1.jpg');
    expect(img.alt).toBe('黑潮之海水槽');
  });

  it('caption with attribution + source link rendered', () => {
    render(<StopLightbox open entry={{ ...ENTRY, photos: PHOTOS }} onClose={() => {}} />);
    const cap = screen.getByTestId('stop-lightbox-caption');
    expect(cap.textContent).toContain('黑潮之海水槽');
    expect(cap.textContent).toContain('CC BY-SA');
    const link = cap.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toBe('https://commons.wikimedia.org/file1');
  });

  it('next button advances photo index', () => {
    render(<StopLightbox open entry={{ ...ENTRY, photos: PHOTOS }} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stop-lightbox-next'));
    const img = screen.getByTestId('stop-lightbox-carousel').querySelector('img') as HTMLImageElement;
    expect(img.src).toContain('photo2.jpg');
  });

  it('prev button wraps from index 0 → last', () => {
    render(<StopLightbox open entry={{ ...ENTRY, photos: PHOTOS }} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stop-lightbox-prev'));
    const img = screen.getByTestId('stop-lightbox-carousel').querySelector('img') as HTMLImageElement;
    expect(img.src).toContain('photo3.jpg');
  });

  it('next button wraps from last → index 0', () => {
    render(<StopLightbox open entry={{ ...ENTRY, photos: PHOTOS }} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stop-lightbox-next'));
    fireEvent.click(screen.getByTestId('stop-lightbox-next'));
    fireEvent.click(screen.getByTestId('stop-lightbox-next'));
    const img = screen.getByTestId('stop-lightbox-carousel').querySelector('img') as HTMLImageElement;
    // PHOTOS[0] 有 thumbUrl，所以回到 index 0 顯示 thumb1.jpg
    expect(img.src).toContain('thumb1.jpg');
  });

  it('arrow keys navigate photos when open', () => {
    render(<StopLightbox open entry={{ ...ENTRY, photos: PHOTOS }} onClose={() => {}} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    const img = screen.getByTestId('stop-lightbox-carousel').querySelector('img') as HTMLImageElement;
    expect(img.src).toContain('photo2.jpg');
  });

  it('single-photo carousel hides nav + pager', () => {
    render(<StopLightbox open entry={{ ...ENTRY, photos: [PHOTOS[0]!] }} onClose={() => {}} />);
    expect(screen.queryByTestId('stop-lightbox-prev')).toBeNull();
    expect(screen.queryByTestId('stop-lightbox-next')).toBeNull();
  });

  it('photo without caption + attribution → no caption div', () => {
    render(<StopLightbox open entry={{ ...ENTRY, photos: [{ url: 'https://x.com/a.jpg' }] }} onClose={() => {}} />);
    expect(screen.queryByTestId('stop-lightbox-caption')).toBeNull();
  });
});
