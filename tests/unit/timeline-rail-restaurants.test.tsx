/**
 * TimelineRail — 餐廳推薦 section in expanded entry detail.
 *
 * Renders entry.infoBoxes[type='restaurants'] sorted by sortOrder ascending.
 * - 0 restaurants → no 餐廳推薦 section
 * - 1 restaurant → standard variant card, no 「備選」 divider
 * - ≥2 restaurants → first = hero variant, then 「備選」 divider, rest = standard
 *
 * Sort is stable: null/undefined sortOrder falls to end (treated as 99).
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

describe('TimelineRail — 餐廳推薦 section', () => {
  it('entry without infoBoxes → no 餐廳推薦 section after expand', () => {
    renderWithEntry(makeEntry());
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    expect(screen.queryByTestId('timeline-rail-rest-437')).toBeNull();
  });

  it('entry with empty restaurants infoBox → no section', () => {
    const entry = makeEntry({
      infoBoxes: [{ type: 'restaurants', restaurants: [] }],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    expect(screen.queryByTestId('timeline-rail-rest-437')).toBeNull();
  });

  it('1 restaurant → renders standard variant, no 備選 divider', () => {
    const entry = makeEntry({
      infoBoxes: [
        {
          type: 'restaurants',
          restaurants: [{ name: '山原そば', sortOrder: 0, category: '沖繩麵' }],
        },
      ],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    const list = screen.getByTestId('timeline-rail-rest-437');
    expect(list.textContent).toContain('山原そば');
    // single card uses standard variant — no [data-variant="hero"]
    expect(list.querySelector('[data-variant="hero"]')).toBeNull();
    // no 備選 divider with single item
    expect(list.textContent).not.toContain('備選');
  });

  it('≥2 restaurants → first hero, second triggers 備選 divider, sorted by sortOrder', () => {
    const entry = makeEntry({
      infoBoxes: [
        {
          type: 'restaurants',
          restaurants: [
            { name: '海人食堂', sortOrder: 2, category: '生魚片' },
            { name: 'きしもと食堂', sortOrder: 0, category: '拉麵' }, // first by sortOrder
            { name: '焼肉もとぶ牧場', sortOrder: 3, category: '燒肉' },
          ],
        },
      ],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    const list = screen.getByTestId('timeline-rail-rest-437');

    // hero is first in DOM order, and it's the lowest-sortOrder item
    const heroCards = list.querySelectorAll('[data-variant="hero"]');
    expect(heroCards).toHaveLength(1);
    expect(heroCards[0]?.textContent).toContain('きしもと食堂');

    // 備選 divider rendered exactly once
    const dividers = list.querySelectorAll('.tp-rail-rest-alt-heading');
    expect(dividers).toHaveLength(1);
    expect(dividers[0]?.textContent).toBe('備選');

    // Order in DOM: hero (sortOrder 0) → divider → standard (sortOrder 2) → standard (sortOrder 3)
    const html = list.innerHTML;
    const idxHero = html.indexOf('きしもと食堂');
    const idxAlt1 = html.indexOf('海人食堂');
    const idxAlt2 = html.indexOf('焼肉もとぶ牧場');
    expect(idxHero).toBeLessThan(idxAlt1);
    expect(idxAlt1).toBeLessThan(idxAlt2);
  });

  it('null/undefined sortOrder → falls to end (treated as 99)', () => {
    const entry = makeEntry({
      infoBoxes: [
        {
          type: 'restaurants',
          restaurants: [
            { name: 'NoOrder', sortOrder: null, category: 'misc' },
            { name: 'First', sortOrder: 0, category: 'misc' },
          ],
        },
      ],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    const list = screen.getByTestId('timeline-rail-rest-437');
    const idxFirst = list.innerHTML.indexOf('First');
    const idxNoOrder = list.innerHTML.indexOf('NoOrder');
    expect(idxFirst).toBeLessThan(idxNoOrder);
  });
});
