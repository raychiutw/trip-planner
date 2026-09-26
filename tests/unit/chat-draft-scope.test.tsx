import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({ apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init) }));
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => undefined }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'u1', email: 'u@example.test' } }) }));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import ChatPage from '../../src/pages/ChatPage';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';
import { EVENT } from '../../src/lib/events';
import { LS_KEY_TRIP_PREF, lsSet } from '../../src/lib/localStorage';

let tripRows: { tripId: string; name: string }[];
let listFails: boolean;
beforeEach(() => {
  localStorage.clear();
  __clearMyTripsCache();
  tripRows = [{ tripId: 'trip-a', name: 'Trip A' }, { tripId: 'trip-b', name: 'Trip B' }];
  listFails = false;
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((path) => {
    if (path === '/my-trips') return listFails ? Promise.reject(new Error('temporary failure')) : Promise.resolve(tripRows);
    if (path === '/account/ai-authorization') return Promise.resolve({ authorized: true });
    if (path.startsWith('/requests')) return Promise.resolve({ items: [], hasMore: false });
    return Promise.resolve(null);
  });
  window.scrollTo = vi.fn();
});

it('keeps an unsent draft through a failed list read and a confirmed empty list', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'trip-a');
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  const input = await screen.findByTestId('chat-input') as HTMLTextAreaElement;
  await waitFor(() => expect(input.disabled).toBe(false));
  fireEvent.change(input, { target: { value: 'Draft for A' } });

  listFails = true;
  const readsBeforeFailure = apiFetchMock.mock.calls.filter(([path]) => path === '/my-trips').length;
  fireEvent(window, new CustomEvent(EVENT.tripUpdated, { detail: { tripId: 'trip-a' } }));
  await waitFor(() => expect(apiFetchMock.mock.calls.filter(([path]) => path === '/my-trips').length).toBeGreaterThan(readsBeforeFailure));
  expect(input.value).toBe('Draft for A');

  listFails = false;
  tripRows = [];
  fireEvent(window, new CustomEvent(EVENT.tripUpdated, { detail: { tripId: 'trip-a' } }));
  await waitFor(() => expect(input.disabled).toBe(true));
  expect(input.value).toBe('');

  tripRows = [{ tripId: 'trip-a', name: 'Trip A' }];
  fireEvent(window, new CustomEvent(EVENT.tripUpdated, { detail: { tripId: 'trip-a' } }));
  await waitFor(() => expect(input.disabled).toBe(false));
  expect(input.value).toBe('Draft for A');
});

it('keeps the draft with its trip when a refreshed list automatically selects another trip', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'trip-a');
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  const input = await screen.findByTestId('chat-input') as HTMLTextAreaElement;
  await waitFor(() => expect(input.disabled).toBe(false));
  fireEvent.change(input, { target: { value: 'Draft for A' } });

  tripRows = [{ tripId: 'trip-b', name: 'Trip B' }];
  fireEvent(window, new CustomEvent(EVENT.tripUpdated, { detail: { tripId: 'trip-a' } }));
  await screen.findByText('Trip B');
  expect(input.value).toBe('');
  tripRows = [{ tripId: 'trip-a', name: 'Trip A' }, { tripId: 'trip-b', name: 'Trip B' }];
  fireEvent(window, new CustomEvent(EVENT.tripUpdated, { detail: { tripId: 'trip-b' } }));
  fireEvent.click(await screen.findByTestId('chat-trip-title'));
  fireEvent.click(await screen.findByTestId('chat-trip-pick-trip-a'));
  expect(input.value).toBe('Draft for A');
});

it('restores each trip draft after manual switching', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'trip-a');
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  const input = await screen.findByTestId('chat-input') as HTMLTextAreaElement;
  await waitFor(() => expect(input.disabled).toBe(false));
  fireEvent.change(input, { target: { value: 'Draft for A' } });
  fireEvent.click(screen.getByTestId('chat-trip-title'));
  fireEvent.click(await screen.findByTestId('chat-trip-pick-trip-b'));
  expect(input.value).toBe('');
  fireEvent.change(input, { target: { value: 'Draft for B' } });
  fireEvent.click(screen.getByTestId('chat-trip-title'));
  fireEvent.click(await screen.findByTestId('chat-trip-pick-trip-a'));
  expect(input.value).toBe('Draft for A');
});

it('places an explicit link prefill in the target trip without replacing the prior draft', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'trip-a');
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider>
    <Link to="/chat?tripId=trip-b&prefill=Plan%20B">Open Trip B</Link>
    <ChatPage />
  </ActiveTripProvider></MemoryRouter>);
  const input = await screen.findByTestId('chat-input') as HTMLTextAreaElement;
  await waitFor(() => expect(input.disabled).toBe(false));
  fireEvent.change(input, { target: { value: 'Draft for A' } });
  fireEvent.click(screen.getByRole('link', { name: 'Open Trip B' }));
  await waitFor(() => expect(input.value).toBe('Plan B'));
  fireEvent.click(screen.getByTestId('chat-trip-title'));
  fireEvent.click(await screen.findByTestId('chat-trip-pick-trip-a'));
  expect(input.value).toBe('Draft for A');
});

it('does not send on the IME confirmation Enter reported with keyCode 229', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'trip-a');
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  const input = await screen.findByTestId('chat-input') as HTMLTextAreaElement;
  await waitFor(() => expect(input.disabled).toBe(false));
  fireEvent.change(input, { target: { value: '輸入中' } });
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: false });
  expect(apiFetchMock.mock.calls.filter(([path, init]) => path === '/requests' && init?.method === 'POST')).toHaveLength(0);
  expect(input.value).toBe('輸入中');
});

it('does not send a gated draft to another trip when authorization completes after switching', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'trip-a');
  let completeAuthorization!: (value: unknown) => void;
  apiFetchMock.mockImplementation((path, init) => {
    if (path === '/my-trips') return Promise.resolve(tripRows);
    if (path === '/account/ai-authorization') {
      return init?.method === 'POST'
        ? new Promise((resolve) => { completeAuthorization = resolve; })
        : Promise.resolve({ authorized: false });
    }
    if (path.startsWith('/requests')) return Promise.resolve({ items: [], hasMore: false });
    return Promise.resolve(null);
  });
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  const input = await screen.findByTestId('chat-input') as HTMLTextAreaElement;
  await waitFor(() => expect(input.disabled).toBe(false));
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/account/ai-authorization', undefined));
  fireEvent.change(input, { target: { value: 'Draft for A' } });
  fireEvent.click(screen.getByTestId('chat-send'));
  fireEvent.click(await screen.findByTestId('ai-consent-authorize'));
  await waitFor(() => expect(completeAuthorization).toBeTypeOf('function'));
  fireEvent.click(screen.getByTestId('chat-trip-title'));
  fireEvent.click(await screen.findByTestId('chat-trip-pick-trip-b'));
  expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
  fireEvent.click(screen.getByTestId('chat-trip-title'));
  fireEvent.click(await screen.findByTestId('chat-trip-pick-trip-a'));
  await act(async () => { completeAuthorization({ authorized: true }); });
  await waitFor(() => expect(screen.queryByTestId('ai-consent-sheet')).toBeNull());
  expect(apiFetchMock.mock.calls.filter(([path, init]) => path === '/requests' && init?.method === 'POST')).toHaveLength(0);
  expect(input.value).toBe('Draft for A');
});

it('keeps a new trip consent prompt when an older trip authorization resolves late', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'trip-a');
  let completeOld!: (value: unknown) => void;
  apiFetchMock.mockImplementation((path, init) => {
    if (path === '/my-trips') return Promise.resolve(tripRows);
    if (path === '/account/ai-authorization') return init?.method === 'POST'
      ? new Promise((resolve) => { completeOld = resolve; })
      : Promise.resolve({ authorized: false });
    if (path.startsWith('/requests')) return Promise.resolve({ items: [], hasMore: false });
    return Promise.resolve(null);
  });
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  const input = await screen.findByTestId('chat-input') as HTMLTextAreaElement;
  await waitFor(() => expect(input.disabled).toBe(false));
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/account/ai-authorization', undefined));
  fireEvent.change(input, { target: { value: 'Draft for A' } });
  fireEvent.click(screen.getByTestId('chat-send'));
  fireEvent.click(await screen.findByTestId('ai-consent-authorize'));
  await waitFor(() => expect(completeOld).toBeTypeOf('function'));
  fireEvent.click(screen.getByTestId('chat-trip-title'));
  fireEvent.click(await screen.findByTestId('chat-trip-pick-trip-b'));
  fireEvent.change(input, { target: { value: 'Draft for B' } });
  fireEvent.click(screen.getByTestId('chat-send'));
  expect(await screen.findByTestId('ai-consent-quoted')).toHaveTextContent('Draft for B');
  await act(async () => { completeOld({ authorized: true }); });
  expect(screen.getByTestId('ai-consent-quoted')).toHaveTextContent('Draft for B');
  expect(apiFetchMock.mock.calls.filter(([path, init]) => path === '/requests' && init?.method === 'POST')).toHaveLength(0);
  fireEvent.click(screen.getByTestId('ai-consent-cancel'));
  fireEvent.click(screen.getByTestId('chat-send'));
  await waitFor(() => expect(apiFetchMock.mock.calls.filter(([path, init]) => path === '/requests' && init?.method === 'POST')).toHaveLength(1));
  expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
});
