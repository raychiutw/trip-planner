import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { NewTripProvider } from '../../src/contexts/NewTripContext';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';
import { EVENT } from '../../src/lib/events';
import TripsListPage from '../../src/pages/TripsListPage';
import TripPage from '../../src/pages/TripPage';

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'u1', email: 'u@x.com' } }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'u@x.com' }, reload: () => {} }),
}));

beforeEach(() => {
  localStorage.clear();
  __clearMyTripsCache();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe('list and actual detail selection', () => {
  it('keeps the viewed scroll position when summaries refresh for the same trip', async () => {
    let listReads = 0;
    const scrollTo = vi.fn((_x: number, y: number) => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
    });
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('scrollY', 0);
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
      if (input === '/api/my-trips') {
        listReads++;
        return Promise.resolve(new Response(JSON.stringify([{ tripId: 't1', name: 'Private' }])));
      }
      if (input === '/api/trips/t1') return Promise.resolve(new Response(JSON.stringify({ id: 't1', name: 'Private', countries: 'JP' })));
      if (input === '/api/trips/t1/days?all=1') return Promise.resolve(new Response(JSON.stringify([
        { id: 1, dayNum: 1, date: '2026-10-24', dayOfWeek: '六', label: '第一天', timeline: [] },
        { id: 2, dayNum: 2, date: '2026-10-25', dayOfWeek: '日', label: '第二天', timeline: [] },
      ])));
      return Promise.resolve(new Response('[]'));
    }));
    render(<MemoryRouter initialEntries={['/trips']}><ActiveTripProvider><TripPage tripId="t1" noShell /></ActiveTripProvider></MemoryRouter>);
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 0));
    fireEvent.click(screen.getByTestId('dn-day-2'));
    expect(screen.getByTestId('dn-day-2').getAttribute('aria-current')).toBe('true');
    vi.stubGlobal('scrollY', 420);
    scrollTo.mockClear();
    await act(async () => window.dispatchEvent(new Event(EVENT.tripUpdated)));
    await waitFor(() => expect(listReads).toBe(2));
    await act(async () => {});
    expect(scrollTo).not.toHaveBeenCalledWith(0, 0);
    expect(window.scrollY).toBe(420);
    expect(screen.getByTestId('dn-day-2').getAttribute('aria-current')).toBe('true');
  });
  it('keeps the legacy query target through the actual router and detail read', async () => {
    const reads: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
      reads.push(input);
      if (input === '/api/my-trips') return Promise.resolve(new Response(JSON.stringify([{ tripId: 'other', name: 'Other' }])));
      if (input === '/api/trips/private') return Promise.resolve(new Response('Missing', { status: 404 }));
      return Promise.resolve(new Response('[]'));
    }));
    render(<MemoryRouter initialEntries={['/trips?trip=private']}><ActiveTripProvider><TripPage noShell /></ActiveTripProvider></MemoryRouter>);
    await waitFor(() => expect(reads).toContain('/api/trips/private'));
    expect(await screen.findByText('無法載入行程')).toBeTruthy();
    expect(reads).not.toContain('/api/trips/other');
  });
  it('shows a list read failure in standalone detail without choosing a trip', async () => {
    const reads: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
      reads.push(input);
      if (input === '/api/my-trips') return Promise.resolve(new Response('Unavailable', { status: 500 }));
      return Promise.resolve(new Response('[]'));
    }));
    render(<MemoryRouter initialEntries={['/trips']}><ActiveTripProvider><TripPage noShell /></ActiveTripProvider></MemoryRouter>);
    expect(await screen.findByText('無法載入行程清單')).toBeTruthy();
    expect(reads.filter((url) => url.startsWith('/api/trips/'))).toHaveLength(0);
  });
  it('keeps an absent explicit target for the real detail read without a second list read', async () => {
    const reads: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
      reads.push(input);
      if (input === '/api/my-trips') return Promise.resolve(new Response(JSON.stringify([{ tripId: 'other', name: 'Other' }])));
      if (input === '/api/trips/private') return Promise.resolve(new Response('Forbidden', { status: 403 }));
      return Promise.resolve(new Response('[]'));
    }));
    render(<MemoryRouter initialEntries={['/trips?selected=private']}><ActiveTripProvider><NewTripProvider>
      <TripsListPage />
    </NewTripProvider></ActiveTripProvider></MemoryRouter>);
    await waitFor(() => expect(reads).toContain('/api/trips/private'));
    await waitFor(() => expect(reads.filter((url) => url === '/api/my-trips')).toHaveLength(1));
    expect(await screen.findByText('無法載入行程')).toBeTruthy();
    expect(reads).not.toContain('/api/trips/other');
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    await waitFor(() => expect(reads.filter((url) => url === '/api/trips/private')).toHaveLength(2));
  });
});
