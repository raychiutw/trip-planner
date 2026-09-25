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

  it('network error → unknown user + retryable error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useCurrentUser());
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.user).toBeUndefined();
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
});
it('temporary failure preserves the last auth hint and reload recovers the actual user',async()=>{
 localStorage.setItem('tripline:authed','1');const fetcher=vi.spyOn(global,'fetch').mockResolvedValueOnce(new Response('{}',{status:503})).mockResolvedValue(new Response(JSON.stringify(SAMPLE_USER)));const {result,rerender}=renderHook(()=>useCurrentUser());await waitFor(()=>expect(result.current.error).toBe(true));expect(result.current.user).toBeUndefined();expect(localStorage.getItem('tripline:authed')).toBe('1');result.current.reload();rerender();await waitFor(()=>expect(result.current.user?.id).toBe(SAMPLE_USER.id));expect(result.current.error).toBe(false);expect(fetcher).toHaveBeenCalledTimes(2);localStorage.clear();
});
