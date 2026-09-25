import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePermissions } from '../../src/hooks/usePermissions';
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const member = { id: 1, email: 'a@example.com', role: 'member', tripId: 'A' };
let http: ReturnType<typeof vi.fn>;
beforeEach(() => { http = vi.fn(async (path: string) => reply(path.includes('/permissions?') ? [member] : { items: [] })); vi.stubGlobal('fetch', http); });
afterEach(() => vi.unstubAllGlobals());
it('loads both lists and authorizes commands only after successful reads', async () => {
  const { result } = renderHook(() => usePermissions('A'));
  expect(result.current.canManage).toBe(false);
  await waitFor(() => expect(result.current.canManage).toBe(true));
  expect(result.current.permissions).toEqual([member]);
});
it('empty trip makes no request', () => {
  const { result } = renderHook(() => usePermissions(''));
  expect(http).not.toHaveBeenCalled(); expect(result.current.permissions).toEqual([]);
});
it.each([401,403,404])('HTTP %s cannot grant management access', async status => {
  http.mockImplementation(async () => reply({}, status));
  const { result } = renderHook(() => usePermissions('A'));
  await waitFor(() => expect(result.current.permLoading).toBe(false));
  expect(result.current.canManage).toBe(false); expect(result.current.permError).toContain('管理');
});
it('failed invitations are explicit while members remain available', async () => {
  http.mockImplementation(async (path: string) => path.includes('/invitations?') ? reply({}, 500) : reply([member]));
  const { result } = renderHook(() => usePermissions('A'));
  await waitFor(() => expect(result.current.permLoading).toBe(false));
  expect(result.current.permissions).toEqual([member]); expect(result.current.invitationError).toContain('待接受邀請'); expect(result.current.canManage).toBe(false);
});
it('latest read wins even when an aborted same-trip response resolves later', async () => {
  let finish!: (response: Response) => void; let reads = 0;
  http.mockImplementation((path: string) => path.includes('/permissions?') && ++reads === 1 ? new Promise<Response>(r => { finish = r; }) : Promise.resolve(reply(path.includes('/permissions?') ? [] : { items: [] })));
  const { result } = renderHook(() => usePermissions('A'));
  await act(async () => result.current.loadPermissions());
  await act(async () => finish(reply([member])));
  expect(result.current.permissions).toEqual([]); expect(result.current.canManage).toBe(true);
});
it('trip A → B → A cannot publish the first A response', async () => {
  let finish!: (response: Response) => void; let reads = 0;
  http.mockImplementation((path: string) => path.includes('/permissions?') && ++reads === 1 ? new Promise<Response>(r => { finish = r; }) : Promise.resolve(reply(path.includes('/permissions?') ? [] : { items: [] })));
  const { result, rerender } = renderHook(({trip}) => usePermissions(trip), { initialProps: { trip: 'A' } });
  rerender({ trip: 'B' }); await waitFor(() => expect(result.current.canManage).toBe(true));
  rerender({ trip: 'A' }); await waitFor(() => expect(result.current.canManage).toBe(true));
  await act(async () => finish(reply([member]))); expect(result.current.permissions).toEqual([]);
});
it('malformed list is an error, not management authority', async () => {
  http.mockImplementation(async () => reply({}));
  const { result } = renderHook(() => usePermissions('A'));
  await waitFor(() => expect(result.current.permLoading).toBe(false));
  expect(result.current.canManage).toBe(false); expect(result.current.permError).toBeTruthy();
});

it('a row from another trip is never exposed as an editable member', async () => {
  http.mockImplementation(async (path: string) => reply(path.includes('/permissions?') ? [{ ...member, tripId: 'B' }] : { items: [] }));
  const { result } = renderHook(() => usePermissions('A'));
  await waitFor(() => expect(result.current.permLoading).toBe(false));
  expect(result.current.canManage).toBe(false); expect(result.current.permissions).toEqual([]);
});
