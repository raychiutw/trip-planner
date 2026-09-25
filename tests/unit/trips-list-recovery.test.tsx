import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import TripsListPage from '../../src/pages/TripsListPage';
import TripPageHost from '../../src/components/trip/TripPageHost';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { NewTripProvider } from '../../src/contexts/NewTripContext';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';
import { LS_KEY_TRIP_PREF, lsGet, lsSet } from '../../src/lib/localStorage';
import { writeTripView } from '../../src/lib/tripViewState';
import { EVENT } from '../../src/lib/events';

const sample = [
  { tripId: 'a', name: 'A 旅程', title: 'A 私人旅程', owner: 'reader@example.com', totalDays: 2, archivedAt: null as string | null },
  { tripId: 'b', name: 'B 旅程', title: 'B 共編旅程', owner: 'other@example.com', totalDays: 2, archivedAt: null as string | null },
];
let summaries: typeof sample;
let status: number;
let desktop: boolean;
let listReads: number;
const response = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code });
beforeEach(() => {
  localStorage.clear(); __clearMyTripsCache(); summaries = structuredClone(sample); status = 200; desktop = false; listReads = 0;
  window.scrollTo = vi.fn(); Element.prototype.scrollTo = vi.fn(); Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: desktop && query.includes('1024'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'https://test');
    if (url.pathname === '/api/oauth/userinfo') return response({ id: 'reader', email: 'reader@example.com', displayName: 'Reader' });
    if (url.pathname === '/api/my-trips') { listReads++; return response(summaries, status); }
    const match = url.pathname.match(/^\/api\/trips\/(a|b)(.*)$/);
    if (match) {
      const id = match[1];
      if (!match[2]) return response({ id, name: `${id} 的完整行程`, published: 1, countries: 'JP' });
      if (match[2] === '/days') return response([1, 2].map(day => ({ id: day, dayNum: day, date: `2026-10-0${day}`, timeline: [] })));
    }
    return response([]);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function Navigation() {
  const location = useLocation(); const navigate = useNavigate();
  return <><output data-testid="location">{location.pathname}{location.search}{location.hash}</output>
    <button onClick={() => navigate(-1)}>瀏覽器返回</button><button onClick={() => navigate(1)}>瀏覽器前進</button></>;
}
function open(path = '/trips') {
  return render(<MemoryRouter initialEntries={[path]}><ActiveTripProvider><NewTripProvider><TripPageHost>
    <Navigation /><Routes><Route path="/trips" element={<TripsListPage />} /></Routes>
  </TripPageHost></NewTripProvider></ActiveTripProvider></MemoryRouter>);
}
function refresh() { act(() => window.dispatchEvent(new CustomEvent(EVENT.tripsUpdated))); }

describe('trip list recovery through real pages', () => {
  it.each([false, true])('preserves existing last-day restoration rules with desktop=%s', async (isDesktop) => {
    desktop = isDesktop;
    lsSet(LS_KEY_TRIP_PREF, 'b');
    writeTripView({ tripId: 'b', dayNum: 2 });
    open();
    if (isDesktop) {
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/trips?selected=b#day2'));
      await screen.findByTestId('trips-trip-title');
    } else {
      await screen.findByTestId('trips-list-card-b');
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/trips$/);
      expect(screen.queryByTestId('trips-trip-title')).not.toBeInTheDocument();
    }
  });

  it('a confirmed empty account offers creation, while a filtered list can clear its choices', async () => {
    summaries = []; const view = open();
    await screen.findByTestId('trips-list-empty');
    expect(screen.queryByTestId('trips-list-empty-filtered')).not.toBeInTheDocument();
    expect(screen.getByTestId('trips-list-new-trip-hero')).toHaveAccessibleName(/新增行程/);
    view.unmount(); __clearMyTripsCache(); summaries = structuredClone(sample);
    summaries[0]!.archivedAt = '2026-09-25T00:00:00Z'; lsSet(LS_KEY_TRIP_PREF, 'a');
    open(); await screen.findByTestId('trips-list-card-b');
    fireEvent.click(screen.getByTestId('trips-list-tab-archived'));
    await screen.findByTestId('trips-list-card-a');
    fireEvent.click(screen.getByTestId('trips-list-search-toggle'));
    fireEvent.change(screen.getByRole('textbox', { name: '搜尋行程' }), { target: { value: '不存在' } });
    expect(screen.getByTestId('trips-list-empty-filtered')).toHaveTextContent('沒有符合條件的行程');
    expect(screen.queryByTestId('trips-list-empty')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清除篩選' }));
    expect(screen.getByTestId('trips-list-card-b')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '搜尋行程' })).toHaveValue('');
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('a');
    const group = screen.getByRole('group', { name: '行程分類' });
    expect(within(group).getByRole('button', { name: /全部/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filtering out the selected trip does not mark another card as selected', async () => {
    desktop = true; open('/trips?selected=b');
    await screen.findByTestId('trips-trip-title');
    fireEvent.click(screen.getByRole('button', { name: '返回行程列表' }));
    await screen.findByTestId('trips-list-card-b');
    fireEvent.click(screen.getByTestId('trips-list-tab-mine'));
    expect(screen.queryByTestId('trips-list-card-b')).not.toBeInTheDocument();
    expect(screen.getByTestId('trips-list-card-a')).not.toHaveAttribute('aria-current');
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('b');
    fireEvent.click(screen.getByTestId('trips-list-tab-all'));
    expect(screen.getByTestId('trips-list-card-b')).toHaveAttribute('aria-current', 'true');
  });

  it('failed list reads offer retry and never appear as an empty account', async () => {
    status = 503; open();
    await screen.findByTestId('trips-list-error');
    expect(screen.queryByTestId('trips-list-empty')).not.toBeInTheDocument();
    status = 200; fireEvent.click(screen.getByRole('button', { name: '重試載入行程' }));
    await screen.findByTestId('trips-list-card-a');
    expect(screen.queryByTestId('trips-list-error')).not.toBeInTheDocument();
    expect(listReads).toBe(2);
  });

  it('failed refresh retains cards and usable filters until retry succeeds', async () => {
    open(); await screen.findByTestId('trips-list-card-a');
    fireEvent.click(screen.getByTestId('trips-list-search-toggle'));
    fireEvent.change(screen.getByRole('textbox', { name: '搜尋行程' }), { target: { value: '私人' } });
    status = 503; refresh(); await screen.findByTestId('trips-list-error');
    expect(screen.getByTestId('trips-list-card-a')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '搜尋行程' })).toHaveValue('私人');
    fireEvent.change(screen.getByRole('textbox', { name: '搜尋行程' }), { target: { value: '共編' } });
    expect(screen.getByTestId('trips-list-card-b')).toBeInTheDocument();
    status = 200; fireEvent.click(screen.getByRole('button', { name: '重試載入行程' }));
    await waitFor(() => expect(screen.queryByTestId('trips-list-error')).not.toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: '搜尋行程' })).toHaveValue('共編');
  });
});
