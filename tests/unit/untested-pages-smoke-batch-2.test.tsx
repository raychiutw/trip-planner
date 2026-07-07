/**
 * untested-pages-smoke-batch-2.test.tsx — Round 23 (v2.33.73)
 *
 * 補剩 7 個 untested page (Round 22 follow-up):
 *   AddCustomStopPage / AddEntryPage / AddStopPage (新增景點 wizard 系列)
 *   EditTripPage / EntryActionPage / NewTripPage (action page)
 *   MapPage (geo)
 *
 * Smoke 只驗 mount 不 throw + 含預期 text。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NewTripProvider } from '../../src/contexts/NewTripContext';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ authReady: true, user: { id: 'test', email: 'test@x.com', displayName: null } }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'test', email: 'test@x.com', displayName: null }, loading: false, refetch: vi.fn() }),
}));
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: vi.fn().mockResolvedValue({}),
  apiFetchRaw: vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })),
}));
// Some pages need Google Maps; mock loader so it doesn't fail.
vi.mock('../../src/hooks/useGoogleMap', () => ({
  useGoogleMap: () => ({ containerRef: { current: null }, map: null, loadError: null, fitBounds: vi.fn(), flyTo: vi.fn() }),
}));

beforeEach(() => {
  if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as never;
  }
});

function wrap(ui: React.ReactNode, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ActiveTripProvider>
        <NewTripProvider>{ui}</NewTripProvider>
      </ActiveTripProvider>
    </MemoryRouter>,
  );
}

describe('Round 23 — NewTripPage smoke', () => {
  it('mount on /trips/new', async () => {
    const { default: NewTripPage } = await import('../../src/pages/NewTripPage');
    const { container } = wrap(<NewTripPage />, '/trips/new');
    expect(container).toBeTruthy();
    expect(container.textContent ?? '').toMatch(/新增行程|建立|目的地|新行程/);
  }, 15_000);
});

describe('Round 23 — EditTripPage smoke', () => {
  it('mount on /trip/:id/edit', async () => {
    const { default: EditTripPage } = await import('../../src/pages/EditTripPage');
    const { container } = render(
      <MemoryRouter initialEntries={['/trip/test-trip/edit']}>
        <ActiveTripProvider>
          <NewTripProvider>
            <Routes>
              <Route path="/trip/:tripId/edit" element={<EditTripPage />} />
            </Routes>
          </NewTripProvider>
        </ActiveTripProvider>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });
});

describe('Round 23 — EntryActionPage smoke', () => {
  it('mount on /trip/:id/stop/:eid/copy with action=copy', async () => {
    const { default: EntryActionPage } = await import('../../src/pages/EntryActionPage');
    const { container } = render(
      <MemoryRouter initialEntries={['/trip/test/stop/1/copy']}>
        <ActiveTripProvider>
          <NewTripProvider>
            <Routes>
              <Route path="/trip/:tripId/stop/:entryId/copy" element={<EntryActionPage action="copy" />} />
            </Routes>
          </NewTripProvider>
        </ActiveTripProvider>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });
});

describe('Round 23 — AddStopPage smoke', () => {
  it('mount on /trip/:id/add-stop', async () => {
    const { default: AddStopPage } = await import('../../src/pages/AddStopPage');
    const { container } = render(
      <MemoryRouter initialEntries={['/trip/test/add-stop']}>
        <ActiveTripProvider>
          <NewTripProvider>
            <Routes>
              <Route path="/trip/:tripId/add-stop" element={<AddStopPage />} />
            </Routes>
          </NewTripProvider>
        </ActiveTripProvider>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });
});

describe('Round 23 — AddEntryPage smoke', () => {
  it('mount on /trip/:id/add-entry', async () => {
    const { default: AddEntryPage } = await import('../../src/pages/AddEntryPage');
    const { container } = render(
      <MemoryRouter initialEntries={['/trip/test/add-entry']}>
        <ActiveTripProvider>
          <NewTripProvider>
            <Routes>
              <Route path="/trip/:tripId/add-entry" element={<AddEntryPage />} />
            </Routes>
          </NewTripProvider>
        </ActiveTripProvider>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });
});

describe('Round 23 — AddCustomStopPage smoke', () => {
  it('mount on /trip/:id/add-custom-stop (mobile-only route, just smoke)', async () => {
    const { default: AddCustomStopPage } = await import('../../src/pages/AddCustomStopPage');
    const { container } = render(
      <MemoryRouter initialEntries={['/trip/test/add-custom-stop']}>
        <ActiveTripProvider>
          <NewTripProvider>
            <Routes>
              <Route path="/trip/:tripId/add-custom-stop" element={<AddCustomStopPage />} />
            </Routes>
          </NewTripProvider>
        </ActiveTripProvider>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });
});

describe('Round 23 — MapPage smoke (under TripLayout)', () => {
  it('mount on /trip/:id/map via TripLayout wrap', async () => {
    const { default: MapPage } = await import('../../src/pages/MapPage');
    const { default: TripLayout } = await import('../../src/pages/TripLayout');
    const { container } = render(
      <MemoryRouter initialEntries={['/trip/test/map']}>
        <ActiveTripProvider>
          <NewTripProvider>
            <Routes>
              <Route path="/trip/:tripId" element={<TripLayout />}>
                <Route path="map" element={<MapPage />} />
              </Route>
            </Routes>
          </NewTripProvider>
        </ActiveTripProvider>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });
});
