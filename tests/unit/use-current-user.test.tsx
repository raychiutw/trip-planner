/**
 * useCurrentUser hook unit test — V2-P1
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCurrentUser } from '../../src/hooks/useCurrentUser';
import { readAuthHint, writeAuthHint } from '../../src/lib/authHint';

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

  it('malformed JSON body (ok response that fails to parse) → user = null', async () => {
    // res.ok = true 但 body 不是合法 JSON —— res.json() 在 .then() 內丟出，落到
    // .catch()；跟「fetch 直接 reject」觸發點不同。
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('not-json', { status: 200 }));
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

  it('a superseded mount fetch that resolves late does not clobber the fresher reload() result', async () => {
    // 這是 `stale` guard 唯一會被觀察到的情境：同一個 hook instance 的舊 effect
    // （mount 那次 fetch）比新 effect（reload() 那次）晚落地。拿掉 guard，舊回應
    // 會把畫面蓋回舊資料 —— 這個測試會轉紅。
    let resolveMount: (res: Response) => void = () => undefined;
    let callCount = 0;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return new Promise<Response>((resolve) => { resolveMount = resolve; });
      }
      return Promise.resolve(new Response(JSON.stringify({ ...SAMPLE_USER, displayName: 'Fresh' }), { status: 200 }));
    });

    const { result, rerender } = renderHook(() => useCurrentUser());
    result.current.reload();
    rerender();
    await waitFor(() => expect(result.current.user?.displayName).toBe('Fresh'));

    // 必須包在 act() 裡：沒有 guard 時舊回應的 setUser 是在 act 外排程的，只等
    // setTimeout(0) 時 React 還沒 commit，會讓這個測試在拿掉 guard 後照樣綠（假綠）。
    await act(async () => {
      resolveMount(new Response(JSON.stringify({ ...SAMPLE_USER, displayName: 'Stale' }), { status: 200 }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.user?.displayName).toBe('Fresh');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('a userinfo response that lands after logout does not overwrite the logout auth hint', async () => {
    // 登出前發出、登出後才落地的請求不能把 hint 蓋回 true（見 lib/authHint 序號）。
    // 舊版靠每個 instance 的 AbortController 擋；共享 fetch 不能被單一 consumer
    // abort，改靠序號。
    writeAuthHint(true);
    let resolveFetch: (res: Response) => void = () => undefined;
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    const { result } = renderHook(() => useCurrentUser());

    writeAuthHint(false); // AccountPage / SessionsPage 登出成功後的寫入
    resolveFetch(new Response(JSON.stringify(SAMPLE_USER), { status: 200 }));
    // user 落地代表 fetchCurrentUser 的 .then（含寫 hint）已經跑完。
    await waitFor(() => expect(result.current.user).toEqual(SAMPLE_USER));
    expect(readAuthHint()).toBe(false);
  });

  it('a failed fetch (network error) clears a stale auth hint', async () => {
    // catch 分支的 writeAuthHint(false)：fetch 直接 reject 時，先前留下的 true 旗標必須被校正。
    writeAuthHint(true);
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useCurrentUser());
    await waitFor(() => expect(result.current.user).toBeNull());
    expect(readAuthHint()).toBe(false);
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

  it('cancelled fetch (unmount) does not crash when it resolves late', async () => {
    // React 18 起已移除「對已卸載元件 setState」的警告，所以這裡驗不到 `stale`
    // guard（guard 由上面「superseded mount fetch」那個測試鎖住）—— 只證明
    // 卸載後才落地的 fetch 不會丟錯或留下 unhandled rejection。
    let resolveFetch: (res: Response) => void = () => undefined;
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    const { unmount } = renderHook(() => useCurrentUser());
    unmount();
    resolveFetch(new Response(JSON.stringify(SAMPLE_USER), { status: 200 }));
    // Let the internal .then/.catch chain actually run to completion — an
    // unhandled rejection or thrown error in it would fail this test.
    await new Promise((resolve) => setTimeout(resolve, 0));
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
    // same in-flight fetch. This proves the dedup itself survives a sibling
    // unmounting mid-flight — hooks[0]/hooks[2] must still land correctly.
    //
    // 這個測試「不」驗 `stale` guard：React 會把對已卸載 fiber 的 setState 靜默
    // 忽略，有沒有 guard 結果都一樣（mutation 實測：拿掉 guard 這裡照樣綠）。
    // guard 真正的工作是同一個 instance 的舊 effect 晚落地時不蓋掉新結果，由上面
    // 「superseded mount fetch」那個測試鎖住。
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
