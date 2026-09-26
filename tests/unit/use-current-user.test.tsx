/**
 * useCurrentUser hook unit test — V2-P1
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCurrentUser } from '../../src/hooks/useCurrentUser';

const SAMPLE_USER = {
  id: 'uid-1',
  email: 'user@example.com',
  emailVerified: true,
  displayName: 'User',
  avatarUrl: 'https://x.com/a.png',
  createdAt: '2026-04-25',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCurrentUser', () => {
  it('initial state user = undefined (loading)', () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.user).toBeUndefined();
  });

  it('successful fetch → user = payload', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_USER), { status: 200 }),
    );
    const { result } = renderHook(() => useCurrentUser());
    await waitFor(() => expect(result.current.user).not.toBeUndefined());
    expect(result.current.user).toEqual(SAMPLE_USER);
  });

  it('401 → user = null (unauthenticated)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'AUTH_REQUIRED' } }), { status: 401 }),
    );
    const { result } = renderHook(() => useCurrentUser());
    await waitFor(() => expect(result.current.user).not.toBeUndefined());
    expect(result.current.user).toBeNull();
  });

  it('network error → user = null', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useCurrentUser());
    await waitFor(() => expect(result.current.user).not.toBeUndefined());
    expect(result.current.user).toBeNull();
  });

  it('reload() triggers re-fetch', async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify({ ...SAMPLE_USER, displayName: `Call ${callCount}` }), { status: 200 });
    });

    const { result, rerender } = renderHook(() => useCurrentUser());
    await waitFor(() => expect(result.current.user?.displayName).toBe('Call 1'));

    result.current.reload();
    rerender();
    await waitFor(() => expect(result.current.user?.displayName).toBe('Call 2'));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('reload() forces a fresh fetch even when called before the mount dedup window clears', async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify({ ...SAMPLE_USER, displayName: `Call ${callCount}` }), { status: 200 });
    });

    const { result, rerender } = renderHook(() => useCurrentUser());
    // 故意不 await 任何東西 —— mount 的 dedup 快取要下一輪 microtask 才清空，
    // 這裡在同一個同步呼叫堆疊裡立刻 reload()，撞上快取還活著的那個瞬間。
    result.current.reload();
    rerender();

    await waitFor(() => expect(result.current.user?.displayName).toBe('Call 2'));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('fetch uses credentials: include for cookie-based auth', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_USER), { status: 200 }),
    );
    renderHook(() => useCurrentUser());
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/oauth/userinfo',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('cancelled fetch (unmount) does not setState (no warning)', async () => {
    let resolveFetch: (res: Response) => void = () => undefined;
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    const { unmount } = renderHook(() => useCurrentUser());
    unmount();
    // Resolve after unmount — should not set state on unmounted component
    resolveFetch(new Response(JSON.stringify(SAMPLE_USER), { status: 200 }));
    // No assertion needed — vitest will warn if setState called on unmounted
  });

  it('concurrent mounts on the same pageload share one in-flight request (no N+1)', async () => {
    // Regression test for Sentry issue 7755796462 — /trip/*/stop/* pageload fired
    // 5 near-simultaneous GET /api/oauth/userinfo because every component mounting
    // useCurrentUser() independently kicked off its own fetch.
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_USER), { status: 200 }),
    );
    const hooks = Array.from({ length: 5 }, () => renderHook(() => useCurrentUser()));
    await Promise.all(
      hooks.map(({ result }) => waitFor(() => expect(result.current.user).not.toBeUndefined())),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    hooks.forEach(({ result }) => expect(result.current.user).toEqual(SAMPLE_USER));
  });

  it('unmounting one of several deduped concurrent mounts does not affect the others', async () => {
    // Real pageloads mix components with different lifetimes (e.g. a sidebar
    // that unmounts on route change vs. a page body that stays) sharing the
    // same in-flight fetch. The unmounted instance's `stale` closure guard
    // must not interfere with the module-level dedup the others still rely on.
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_USER), { status: 200 }),
    );
    const hooks = Array.from({ length: 3 }, () => renderHook(() => useCurrentUser()));
    hooks[1].unmount();
    await Promise.all(
      [hooks[0], hooks[2]].map(({ result }) => waitFor(() => expect(result.current.user).not.toBeUndefined())),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(hooks[0].result.current.user).toEqual(SAMPLE_USER);
    expect(hooks[2].result.current.user).toEqual(SAMPLE_USER);
    // No assertion needed for hooks[1] — vitest/RTL warns if setState fired on the unmounted instance.
  });

  it('dedup window does not survive a real microtask tick (no accidental long-lived cache)', async () => {
    // Pins the invariant the header comment promises: the shared in-flight
    // promise only lives for one microtask, so two mounts separated by even
    // a single `await Promise.resolve()` must NOT dedup onto each other.
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_USER), { status: 200 }),
    );
    renderHook(() => useCurrentUser());
    await Promise.resolve();
    renderHook(() => useCurrentUser());
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });

  it('a shared in-flight request that fails resolves every concurrent subscriber to null', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'AUTH_REQUIRED' } }), { status: 401 }),
    );
    const hooks = Array.from({ length: 3 }, () => renderHook(() => useCurrentUser()));
    await Promise.all(
      hooks.map(({ result }) => waitFor(() => expect(result.current.user).not.toBeUndefined())),
    );
    hooks.forEach(({ result }) => expect(result.current.user).toBeNull());
  });
});
