import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import ChatPage from '../../src/pages/ChatPage';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';
import { LS_KEY_TRIP_PREF, LS_PREFIX, lsGet, lsRemove, lsSet } from '../../src/lib/localStorage';
import { EVENT } from '../../src/lib/events';

const user = { id: 'user-1', email: 'user@example.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' };
const trips = [
  { tripId: 'first', name: '公開行程', title: '公開標題', countries: 'JP' },
  { tripId: 'private', name: '私人行程', title: '私人標題', countries: 'TW', startDate: '2026-10-01', totalDays: 3 },
];
let listResponse: () => Promise<Response>;
let listReads: number;
let requestedPaths: string[];
let sentTripIds: string[];
let sentMessages: string[];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('EventSource', class { close() {} });
  __clearMyTripsCache();
  lsRemove(LS_KEY_TRIP_PREF);
  listReads = 0;
  requestedPaths = [];
  sentTripIds = [];
  sentMessages = [];
  listResponse = async () => new Response(JSON.stringify(trips));
  vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input);
    requestedPaths.push(path);
    if (path.includes('/requests') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      sentTripIds.push(body.tripId);
      sentMessages.push(body.message);
      return new Response(JSON.stringify({ id: 42 }));
    }
    if (path.includes('/oauth/userinfo')) return new Response(JSON.stringify(user));
    if (path.includes('/my-trips')) { listReads++; return listResponse(); }
    if (path.includes('/account/ai-authorization')) return new Response(JSON.stringify({ authorized: true }));
    if (path.includes('/requests')) return new Response(JSON.stringify({ items: [], hasMore: false }));
    return new Response('{}');
  });
});

function openChat(path = '/chat') {
  return render(<MemoryRouter initialEntries={[path]}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
}

function NavigateToLinkedChat() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/chat?tripId=linked&prefill=新增一個景點')}>open linked chat</button>;
}

function NavigateToFirstChat() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/chat?tripId=first')}>open first chat</button>;
}

describe('chat active trip selection', () => {
  it('keeps an explicit chat target even when it is absent from the accessible list', async () => {
    lsSet(LS_KEY_TRIP_PREF, 'private');
    openChat('/chat?tripId=linked');
    await waitFor(() => expect(requestedPaths.some((path) => path.includes('/requests?tripId=linked'))).toBe(true));
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('linked');
  });

  it('honors a new explicit target while the chat page stays mounted', async () => {
    render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider>
      <NavigateToLinkedChat /><ChatPage />
    </ActiveTripProvider></MemoryRouter>);
    await screen.findByTestId('sidebar-trip-private');
    fireEvent.click(await screen.findByTestId('chat-trip-title'));
    fireEvent.click(await screen.findByTestId('chat-trip-pick-private'));
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private'));
    fireEvent.click(screen.getByText('open linked chat'));
    await waitFor(() => expect(requestedPaths.some((path) => path.includes('/requests?tripId=linked'))).toBe(true));
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('linked');
    expect((screen.getByTestId('chat-input') as HTMLTextAreaElement).value).toBe('新增一個景點');
  });

  it('同頁無 prefill 連結切回 A 時保留各行程草稿，只送 A 的文字', async () => {
    render(<MemoryRouter initialEntries={['/chat?tripId=first']}><ActiveTripProvider>
      <NavigateToFirstChat /><ChatPage />
    </ActiveTripProvider></MemoryRouter>);
    const input = await screen.findByTestId('chat-input') as HTMLTextAreaElement;
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('first'));
    fireEvent.change(input, { target: { value: 'A 的草稿' } });
    fireEvent.click(await screen.findByTestId('chat-trip-title'));
    fireEvent.click(await screen.findByTestId('chat-trip-pick-private'));
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private'));
    fireEvent.change(input, { target: { value: 'B 的草稿' } });

    fireEvent.click(screen.getByText('open first chat'));
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('first'));
    expect(input.value).toBe('A 的草稿');
    fireEvent.click(screen.getByTestId('chat-send'));
    await waitFor(() => expect(sentTripIds).toEqual(['first']));
    expect(sentMessages).toEqual(['A 的草稿']);

    fireEvent.click(screen.getByTestId('chat-trip-title'));
    fireEvent.click(await screen.findByTestId('chat-trip-pick-private'));
    expect(input.value).toBe('B 的草稿');
  });

  it('shares the private trip choice with the connected sidebar and persists it', async () => {
    openChat();
    const picker = await screen.findByTestId('chat-trip-title');
    fireEvent.click(picker);
    fireEvent.click(await screen.findByTestId('chat-trip-pick-private'));
    await waitFor(() => expect(screen.getByTestId('sidebar-trip-private').getAttribute('aria-current')).toBe('page'));
    expect(screen.getByTestId('sidebar-trip-private').textContent).toContain('私人行程');
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private');
    expect(requestedPaths.some((path) => path.includes('/requests?tripId=private'))).toBe(true);
    expect(listReads).toBe(1);
    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: '請幫我調整行程' } });
    fireEvent.click(screen.getByTestId('chat-send'));
    await waitFor(() => expect(sentTripIds).toEqual(['private']));
  });

  it('手動切換後原連結目標不阻止失效行程回退，訊息送到可存取行程', async () => {
    openChat('/chat?tripId=first');
    await waitFor(() => expect(requestedPaths.some((path) => path.includes('/requests?tripId=first'))).toBe(true));

    fireEvent.click(await screen.findByTestId('chat-trip-title'));
    fireEvent.click(await screen.findByTestId('chat-trip-pick-private'));
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private'));
    await waitFor(() => expect(requestedPaths.some((path) => path.includes('/requests?tripId=private'))).toBe(true));

    listResponse = async () => new Response(JSON.stringify([trips[0]]));
    act(() => window.dispatchEvent(new CustomEvent(EVENT.tripDeleted, { detail: { tripId: 'private' } })));
    await waitFor(() => expect(listReads).toBe(2));
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('first'));

    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: '請幫我調整行程' } });
    fireEvent.click(screen.getByTestId('chat-send'));
    await waitFor(() => expect(sentTripIds).toEqual(['first']));
  });

  it('失效行程回退時恢復 A 草稿，不將 B 草稿送給 A，回選 B 後保留 B 草稿', async () => {
    openChat('/chat?tripId=first');
    const input = await screen.findByTestId('chat-input') as HTMLTextAreaElement;
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('first'));
    fireEvent.change(input, { target: { value: 'A 的草稿' } });

    fireEvent.click(screen.getByTestId('chat-trip-title'));
    fireEvent.click(await screen.findByTestId('chat-trip-pick-private'));
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private'));
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: 'B 的草稿' } });

    listResponse = async () => new Response(JSON.stringify([trips[0]]));
    act(() => window.dispatchEvent(new CustomEvent(EVENT.tripDeleted, { detail: { tripId: 'private' } })));
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('first'));
    expect(input.value).toBe('A 的草稿');
    fireEvent.click(screen.getByTestId('chat-send'));
    await waitFor(() => expect(sentTripIds).toEqual(['first']));
    expect(sentMessages).toEqual(['A 的草稿']);

    listResponse = async () => new Response(JSON.stringify(trips));
    act(() => window.dispatchEvent(new CustomEvent(EVENT.tripCreated, { detail: { tripId: 'private' } })));
    await screen.findByTestId('sidebar-trip-private');
    fireEvent.click(screen.getByTestId('chat-trip-title'));
    fireEvent.click(await screen.findByTestId('chat-trip-pick-private'));
    expect(input.value).toBe('B 的草稿');
  });

  it('空清單後 A 再出現時恢復 A 草稿，並只送到 A', async () => {
    openChat('/chat?tripId=first');
    const input = await screen.findByTestId('chat-input') as HTMLTextAreaElement;
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('first'));
    fireEvent.change(input, { target: { value: 'A 的草稿' } });
    fireEvent.click(screen.getByTestId('chat-trip-title'));
    fireEvent.click(await screen.findByTestId('chat-trip-pick-private'));
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private'));
    fireEvent.change(input, { target: { value: 'B 的草稿' } });

    listResponse = async () => new Response('[]');
    act(() => window.dispatchEvent(new CustomEvent(EVENT.tripDeleted, { detail: { tripId: 'private' } })));
    await screen.findByText('還沒有行程可以聊');
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBeNull());

    listResponse = async () => new Response(JSON.stringify([trips[0]]));
    act(() => window.dispatchEvent(new CustomEvent(EVENT.tripCreated, { detail: { tripId: 'first' } })));
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('first'));
    const restoredInput = await screen.findByTestId('chat-input') as HTMLTextAreaElement;
    expect(restoredInput.value).toBe('A 的草稿');
    fireEvent.click(screen.getByTestId('chat-send'));
    await waitFor(() => expect(sentTripIds).toEqual(['first']));
    expect(sentMessages).toEqual(['A 的草稿']);
  });

  it('preserves the preference when the accessible list read fails', async () => {
    lsSet(LS_KEY_TRIP_PREF, 'private');
    listResponse = async () => new Response('{}', { status: 503 });
    openChat();
    await waitFor(() => expect(listReads).toBeGreaterThan(0));
    await waitFor(() => expect(requestedPaths.some((path) => path.includes('/requests?tripId=private'))).toBe(true));
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private');
    expect(screen.queryByText('還沒有行程可以聊')).toBeNull();
  });

  it('falls back from a confirmed invalid preference to the first accessible trip', async () => {
    lsSet(LS_KEY_TRIP_PREF, 'removed');
    openChat();
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('first'));
    await waitFor(() => expect(requestedPaths.some((path) => path.includes('/requests?tripId=first'))).toBe(true));
  });

  it('shows the original empty state only after a successful empty list', async () => {
    listResponse = async () => new Response('[]');
    openChat();
    expect(await screen.findByText('還沒有行程可以聊')).toBeTruthy();
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBeNull();
  });

  it('shows a read error instead of the empty state when there is no preference', async () => {
    listResponse = async () => new Response('{}', { status: 503 });
    openChat();
    expect(await screen.findByText('載入行程失敗，請稍後再試')).toBeTruthy();
    expect(screen.getByText('行程清單載入失敗')).toBeTruthy();
    expect(screen.queryByText('還沒有行程可以聊')).toBeNull();
    expect(screen.queryByText('尚無行程')).toBeNull();
  });

  it('does not keep calling a failed refresh of an empty list confirmed empty', async () => {
    listResponse = async () => new Response('[]');
    openChat();
    expect(await screen.findByText('還沒有行程可以聊')).toBeTruthy();
    expect(screen.getByText('尚無行程')).toBeTruthy();
    listResponse = async () => new Response('{}', { status: 503 });
    act(() => window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId: 'removed' } })));
    expect(await screen.findByText('載入行程失敗，請稍後再試')).toBeTruthy();
    expect(screen.getByText('行程清單載入失敗')).toBeTruthy();
    expect(screen.queryByText('尚無行程')).toBeNull();
  });

  it('keeps the last confirmed empty state visible while its refresh is pending', async () => {
    listResponse = async () => new Response('[]');
    openChat();
    expect(await screen.findByText('還沒有行程可以聊')).toBeTruthy();
    expect(screen.getByText('尚無行程')).toBeTruthy();
    let finishRefresh: ((response: Response) => void) | undefined;
    listResponse = () => new Promise((resolve) => { finishRefresh = resolve; });
    act(() => window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId: 'new' } })));
    await waitFor(() => expect(finishRefresh).toBeDefined());
    expect(screen.getByText('還沒有行程可以聊')).toBeTruthy();
    expect(screen.getByText('尚無行程')).toBeTruthy();
    await act(async () => finishRefresh!(new Response('[]')));
  });

  it('keeps an embedded chat locked to its trip after a storage event', async () => {
    render(<MemoryRouter initialEntries={['/chat']}>
      <ActiveTripProvider><ChatPage embedded lockTripId="private" /></ActiveTripProvider>
    </MemoryRouter>);
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private'));
    const newValue = JSON.stringify({ v: 'first', exp: Date.now() + 86_400_000 });
    localStorage.setItem(`${LS_PREFIX}${LS_KEY_TRIP_PREF}`, newValue);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: `${LS_PREFIX}${LS_KEY_TRIP_PREF}`, newValue })));
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private'));
  });

  it('does not replace a newer chat choice with a list read started earlier', async () => {
    let finishRefresh: ((response: Response) => void) | undefined;
    openChat();
    await screen.findByTestId('chat-trip-title');
    listResponse = () => new Promise((resolve) => { finishRefresh = resolve; });
    act(() => window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId: 'private' } })));
    await waitFor(() => expect(finishRefresh).toBeDefined());
    fireEvent.click(screen.getByTestId('chat-trip-title'));
    fireEvent.click(await screen.findByTestId('chat-trip-pick-private'));
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private'));
    await act(async () => finishRefresh!(new Response(JSON.stringify([trips[0]]))));
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private');
    expect(requestedPaths.some((path) => path.includes('/requests?tripId=private'))).toBe(true);
  });

  it('loads a newly created trip when the normal creation event fires', async () => {
    openChat();
    await screen.findByTestId('sidebar-trip-private');
    listResponse = async () => new Response(JSON.stringify([...trips, { tripId: 'new', name: '新增行程' }]));
    act(() => window.dispatchEvent(new CustomEvent(EVENT.tripCreated, { detail: { tripId: 'new' } })));
    expect(await screen.findByTestId('sidebar-trip-new')).toHaveProperty('textContent', '新增行程');
  });

  it('refreshes chat and sidebar names after a trip update without changing the choice', async () => {
    lsSet(LS_KEY_TRIP_PREF, 'private');
    openChat();
    await waitFor(() => expect(screen.getByTestId('sidebar-trip-private').getAttribute('aria-current')).toBe('page'));
    listResponse = async () => new Response(JSON.stringify([trips[0], { ...trips[1], name: '更新後私人行程', title: '更新後標題' }]));
    act(() => window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId: 'private' } })));
    await waitFor(() => expect(screen.getByTestId('sidebar-trip-private').textContent).toContain('更新後私人行程'));
    expect(screen.getByTestId('chat-trip-title').textContent).toContain('更新後標題');
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private');
  });
});
