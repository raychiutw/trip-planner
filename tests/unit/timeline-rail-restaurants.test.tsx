/**
 * TimelineRail — entry POI choices in expanded entry detail.
 *
 * Renders entry.stopPois sorted by sortOrder ascending.
 * - 0/1 POI → no choice section
 * - ≥2 POIs → first = 正選 card, then 「備選」 divider, rest = same generic card
 *
 * Sort is stable: null/undefined sortOrder falls to end (treated as 99).
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';

function makeEntry(overrides: Partial<TimelineEntryData> = {}): TimelineEntryData {
  return {
    id: 437,
    time: '13:05-14:35',
    title: '本部午餐',
    description: '本部町在地美食',
    note: null,
    googleRating: 4.1,
    ...overrides,
  };
}

function renderWithEntry(entry: TimelineEntryData) {
  return render(
    <MemoryRouter>
      <TripIdContext.Provider value="okinawa-2026">
        <TimelineRail events={[entry]} />
      </TripIdContext.Provider>
    </MemoryRouter>,
  );
}

describe('TimelineRail — 景點選擇 section', () => {
  it('entry without stopPois → no 景點選擇 section after expand', () => {
    renderWithEntry(makeEntry());
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    expect(screen.queryByTestId('timeline-rail-pois-437')).toBeNull();
  });

  it('entry with empty stopPois → no section', () => {
    const entry = makeEntry({
      stopPois: [],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    expect(screen.queryByTestId('timeline-rail-pois-437')).toBeNull();
  });

  it('1 stop POI → no choice section', () => {
    const entry = makeEntry({
      stopPois: [{ name: '山原そば', sortOrder: 1, category: '沖繩麵' }],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    expect(screen.queryByTestId('timeline-rail-pois-437')).toBeNull();
  });

  it('≥2 stop POIs → first 正選, second triggers 備選 divider, sorted by sortOrder', () => {
    const entry = makeEntry({
      stopPois: [
        { name: '海人食堂', sortOrder: 2, category: '生魚片' },
        { name: 'きしもと食堂', sortOrder: 1, category: '拉麵' },
        { name: '焼肉もとぶ牧場', sortOrder: 3, category: '燒肉' },
      ],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    const list = screen.getByTestId('timeline-rail-pois-437');

    const primaryCards = list.querySelectorAll('[data-variant="primary"]');
    expect(primaryCards).toHaveLength(1);
    expect(primaryCards[0]?.textContent).toContain('きしもと食堂');
    expect(primaryCards[0]?.textContent).toContain('正選');

    // 備選 divider rendered exactly once
    const dividers = list.querySelectorAll('.tp-rail-poi-alt-heading');
    expect(dividers).toHaveLength(1);
    expect(dividers[0]?.textContent).toBe('備選');

    // Order in DOM: primary (sortOrder 1) → divider → alternate (sortOrder 2) → alternate (sortOrder 3)
    const html = list.innerHTML;
    const idxHero = html.indexOf('きしもと食堂');
    const idxAlt1 = html.indexOf('海人食堂');
    const idxAlt2 = html.indexOf('焼肉もとぶ牧場');
    expect(idxHero).toBeLessThan(idxAlt1);
    expect(idxAlt1).toBeLessThan(idxAlt2);
  });

  it('null/undefined sortOrder → falls to end (treated as 99)', () => {
    const entry = makeEntry({
      stopPois: [
        { name: 'NoOrder', sortOrder: null, category: 'misc' },
        { name: 'First', sortOrder: 1, category: 'misc' },
      ],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    const list = screen.getByTestId('timeline-rail-pois-437');
    const idxFirst = list.innerHTML.indexOf('First');
    const idxNoOrder = list.innerHTML.indexOf('NoOrder');
    expect(idxFirst).toBeLessThan(idxNoOrder);
  });
});
