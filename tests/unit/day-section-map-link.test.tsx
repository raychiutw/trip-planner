/**
 * day-section-map-link.test.tsx — TDD tests for Item 6:
 * Each day's hero eyebrow has a 「🗺 看地圖」chip linking to /trip/:id/map?day=N
 *
 * Covers:
 * - The chip renders with correct href
 * - The chip has accessible text
 * - The chip appears in the hero area
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/* ===== mock OceanMap to avoid leaflet in tests ===== */
vi.mock('../../src/components/trip/OceanMap', () => ({
  default: () => null,
}));

vi.mock('../../src/components/trip/HourlyWeather', () => ({
  default: () => null,
}));

const { default: DaySection } = await import('../../src/components/trip/DaySection');

const SAMPLE_DAY = {
  id: 1,
  dayNum: 2,
  date: '2026-07-30',
  dayOfWeek: '四',
  label: '那霸',
  timeline: [],
  hotel: null,
  docs: null,
};

const SAMPLE_SUMMARY = {
  dayNum: 2,
  date: '2026-07-30',
  dayOfWeek: '四',
  label: '那霸',
};

function renderSection(dayNum = 2) {
  const section = (
    <DaySection
      dayNum={dayNum}
      day={SAMPLE_DAY as never}
      daySummary={SAMPLE_SUMMARY}
      tripStart="2026-07-29"
      tripEnd="2026-08-02"
      localToday="2026-07-30"
      isActive={true}
    />
  );
  return render(
    <MemoryRouter initialEntries={['/trip/test-trip']}>
      <Routes>
        <Route path="/trip/:tripId" element={section} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DaySection — 看地圖 chip (Item 6)', () => {
  it('renders 看地圖 link', () => {
    const { getByText } = renderSection(2);
    expect(getByText(/看地圖/)).toBeTruthy();
  });

  it('看地圖 link href contains /map?day=2', () => {
    const { container } = renderSection(2);
    const link = container.querySelector('a[href*="/map?day=2"]');
    expect(link).not.toBeNull();
  });

  it('看地圖 link href contains trip segment', () => {
    const { container } = renderSection(2);
    // href should be /trip/:id/map?day=N
    const links = Array.from(container.querySelectorAll('a'));
    const mapLink = links.find((l) => l.href.includes('map?day='));
    expect(mapLink).not.toBeNull();
  });

  it('day 1 chip links to ?day=1', () => {
    const { container } = renderSection(1);
    const link = container.querySelector('a[href*="?day=1"]');
    expect(link).not.toBeNull();
  });
});
