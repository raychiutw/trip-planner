import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DaySection from '../../src/components/trip/DaySection';
import type { Day } from '../../src/types/trip';

vi.mock('../../src/contexts/TripIdContext', () => ({
  useTripId: () => 'trip-1',
}));
vi.mock('../../src/hooks/useTripSegments', () => ({
  useTripSegments: () => ({ segmentMap: new Map() }),
}));
vi.mock('../../src/components/trip/Timeline', () => ({
  default: () => <div data-testid="timeline">行程時間軸</div>,
}));

const day: Day = {
  id: 1,
  dayNum: 1,
  date: '2026-08-03',
  hotel: null,
  timeline: [
    {
      id: 11,
      sortOrder: 0,
      title: '首里城',
      startTime: '09:00',
      shopping: [],
      master: { poiId: 101, name: '首里城', lat: 26.217, lng: 127.719 },
    },
  ],
};

describe('DaySection without system weather', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T12:00:00+08:00'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders the timeline directly after the Hero without weather UI or requests', () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => new Promise<Response>(() => {}));

    render(
      <DaySection
        dayNum={1}
        day={day}
        daySummary={undefined}
      />,
    );

    const timeline = screen.getByTestId('timeline');
    const hero = document.querySelector('.tp-hero');
    expect(hero?.nextElementSibling?.firstElementChild).toBe(timeline);
    expect(screen.queryByText(/天氣|預報/)).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('loading state contains only the header and timeline skeletons', () => {
    render(
      <DaySection
        dayNum={1}
        day={undefined}
        daySummary={undefined}
      />,
    );

    expect(screen.getByRole('status', { name: '行程載入中' }).children).toHaveLength(3);
  });
});
