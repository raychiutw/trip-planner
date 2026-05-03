/**
 * TripSheet — URL-driven tab content tests.
 *
 * Mock TripMapRail to avoid Leaflet dependency in jsdom.
 *
 * V2 cutover (migration 0046): 'ideas' tab retired — 備案概念合一進「我的收藏」。
 * SHEET_TABS now: itinerary / map / chat (3 tabs).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import React from 'react';

vi.mock('../../src/components/trip/TripMapRail', () => ({
  default: (props: { tripId: string }) => (
    <div data-testid="mock-trip-map-rail">Mocked TripMapRail for {props.tripId}</div>
  ),
}));

import TripSheet from '../../src/components/trip/TripSheet';

function LocationSpy({ onChange }: { onChange: (loc: { pathname: string; search: string }) => void }) {
  const loc = useLocation();
  React.useEffect(() => {
    onChange({ pathname: loc.pathname, search: loc.search });
  }, [loc.pathname, loc.search, onChange]);
  return null;
}

function renderSheet(initialPath: string, onLocChange: (loc: { pathname: string; search: string }) => void = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/trip/:tripId"
          element={
            <>
              <LocationSpy onChange={onLocChange} />
              <TripSheet tripId="abc" allPins={[]} pinsByDay={new Map()} />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TripSheet — URL-driven tab', () => {
  it('no sheet param defaults to Map tab (過渡方案，對齊 B-P2 行為)', async () => {
    const { findByTestId } = renderSheet('/trip/abc');
    expect(await findByTestId('mock-trip-map-rail')).toBeTruthy();
  });

  it('?sheet=foo invalid value degrades to default (map) without throwing', async () => {
    const { findByTestId } = renderSheet('/trip/abc?sheet=haxxor');
    expect(await findByTestId('mock-trip-map-rail')).toBeTruthy();
  });

  it('?sheet=ideas (legacy) degrades to default (deep-link compat post-cutover)', async () => {
    const { findByTestId } = renderSheet('/trip/abc?sheet=ideas');
    expect(await findByTestId('mock-trip-map-rail')).toBeTruthy();
  });

  it('?sheet=itinerary renders Itinerary placeholder', () => {
    const { getByTestId } = renderSheet('/trip/abc?sheet=itinerary');
    expect(getByTestId('tab-itinerary')).toBeTruthy();
  });

  it('?sheet=chat renders Chat placeholder', () => {
    const { getByTestId } = renderSheet('/trip/abc?sheet=chat');
    expect(getByTestId('tab-chat')).toBeTruthy();
  });

  it('clicking a tab updates URL query param (via replace)', () => {
    const locs: Array<{ pathname: string; search: string }> = [];
    const { getByTestId } = renderSheet('/trip/abc?sheet=map', (loc) => {
      locs.push(loc);
    });
    fireEvent.click(getByTestId('trip-sheet-tab-itinerary'));
    const last = locs[locs.length - 1];
    expect(last.search).toContain('sheet=itinerary');
  });

  it('close button clears sheet param', () => {
    const locs: Array<{ pathname: string; search: string }> = [];
    const { getByTestId } = renderSheet('/trip/abc?sheet=itinerary', (loc) => {
      locs.push(loc);
    });
    fireEvent.click(getByTestId('trip-sheet-close'));
    const last = locs[locs.length - 1];
    expect(last.search).not.toContain('sheet=');
  });

  it('renders 3 tabs with expected labels', () => {
    const { getByTestId } = renderSheet('/trip/abc?sheet=map');
    expect(getByTestId('trip-sheet-tab-itinerary').textContent).toBe('行程');
    expect(getByTestId('trip-sheet-tab-map').textContent).toBe('地圖');
    expect(getByTestId('trip-sheet-tab-chat').textContent).toBe('聊天');
  });
});
