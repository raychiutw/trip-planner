import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DaySection from '../../src/components/trip/DaySection';

vi.mock('../../src/contexts/TripIdContext', () => ({
  useTripId: () => 'trip-1',
}));
vi.mock('../../src/hooks/useTripSegments', () => ({
  useTripSegments: () => ({ segmentMap: new Map() }),
}));
vi.mock('../../src/components/trip/Timeline', () => ({
  default: () => <div data-testid="timeline" />,
}));
vi.mock('../../src/components/trip/HourlyWeather', () => ({
  default: ({ weatherDay }: { weatherDay: unknown }) => (
    <div data-testid="weather">{weatherDay == null ? 'no-location' : 'live-location'}</div>
  ),
}));

describe('DaySection weather', () => {
  it('keeps the weather row mounted when the day has no forecast location', () => {
    render(
      <DaySection
        dayNum={1}
        day={{ id: 1, dayNum: 1, date: '2026-07-29', hotel: null, timeline: [] }}
        daySummary={undefined}
        tripStart="2026-07-29"
        tripEnd="2026-08-02"
      />,
    );

    expect(screen.getByTestId('weather')).toHaveTextContent('no-location');
  });
});
