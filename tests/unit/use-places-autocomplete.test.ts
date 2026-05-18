/**
 * usePlacesAutocomplete hook tests — v2.31.94 custom-stop-location-picker
 *
 * Hook 行為：
 *   - Debounce 300ms：rapid setQuery 只 fire 最後一次
 *   - Min length 2：低於不 fetch
 *   - Session token：首次 setQuery 生成 UUID，rotate on pickSuggestion / reset / clear
 *   - In-memory cache：同 query 不重複打
 *   - Abort：query 變動取消舊 in-flight
 *   - Cleanup：unmount 不 setState
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlacesAutocomplete, __internal } from '../../src/hooks/usePlacesAutocomplete';

let uuidCounter = 0;

beforeEach(() => {
  uuidCounter = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`,
  );
  __internal.clearCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOk(predictions: Array<{ placeId: string; primaryText: string; secondaryText: string }>) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ predictions }),
  } as unknown as Response);
}

function mockFetchReject(err: Error) {
  global.fetch = vi.fn().mockRejectedValue(err);
}

describe('usePlacesAutocomplete', () => {
  it('initial state: empty query / no predictions / not loading', () => {
    const { result } = renderHook(() => usePlacesAutocomplete());
    expect(result.current.query).toBe('');
    expect(result.current.predictions).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('setQuery below minLength → does NOT fetch', async () => {
    mockFetchOk([]);
    const { result } = renderHook(() => usePlacesAutocomplete({ debounceMs: 10 }));
    act(() => result.current.setQuery('a'));
    await new Promise((r) => setTimeout(r, 50));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('setQuery ≥ minLength → fetches /api/places/autocomplete after debounce', async () => {
    mockFetchOk([
      { placeId: 'ChIJ_a', primaryText: '高雄市左營區', secondaryText: 'Kaohsiung, Taiwan' },
    ]);
    const { result } = renderHook(() => usePlacesAutocomplete({ debounceMs: 10 }));
    act(() => result.current.setQuery('高雄市左營'));
    await waitFor(() => expect(result.current.predictions).toHaveLength(1));
    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toContain('/api/places/autocomplete');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.q).toBe('高雄市左營');
    expect(body.sessionToken).toBe('uuid-1');
  });

  it('forwards regionCode option', async () => {
    mockFetchOk([]);
    const { result } = renderHook(() =>
      usePlacesAutocomplete({ debounceMs: 10, regionCode: 'tw' }),
    );
    act(() => result.current.setQuery('高雄'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1];
    const body = JSON.parse(init.body);
    expect(body.regionCode).toBe('tw');
  });

  it('debounces: rapid setQuery only fires last', async () => {
    mockFetchOk([]);
    const { result } = renderHook(() => usePlacesAutocomplete({ debounceMs: 30 }));
    act(() => result.current.setQuery('高'));
    act(() => result.current.setQuery('高雄'));
    act(() => result.current.setQuery('高雄市左營'));
    await new Promise((r) => setTimeout(r, 80));
    expect(global.fetch).toHaveBeenCalledOnce();
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1];
    expect(JSON.parse(init.body).q).toBe('高雄市左營');
  });

  it('caches: same query twice within session → only 1 fetch', async () => {
    mockFetchOk([{ placeId: 'ChIJ_a', primaryText: 'A', secondaryText: 'B' }]);
    const { result } = renderHook(() => usePlacesAutocomplete({ debounceMs: 10 }));
    act(() => result.current.setQuery('高雄'));
    await waitFor(() => expect(result.current.predictions).toHaveLength(1));
    act(() => result.current.setQuery(''));
    act(() => result.current.setQuery('高雄'));
    await new Promise((r) => setTimeout(r, 30));
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('pickSuggestion rotates session token (next fetch uses new uuid)', async () => {
    mockFetchOk([{ placeId: 'ChIJ_a', primaryText: 'A', secondaryText: 'B' }]);
    const { result } = renderHook(() => usePlacesAutocomplete({ debounceMs: 10 }));
    act(() => result.current.setQuery('高雄'));
    await waitFor(() => expect(result.current.predictions).toHaveLength(1));
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body).toContain('uuid-1');

    act(() => result.current.pickSuggestion('ChIJ_a'));
    expect(result.current.predictions).toEqual([]);

    act(() => result.current.setQuery('沖繩'));
    await waitFor(() =>
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2),
    );
    const newBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]![1].body);
    expect(newBody.sessionToken).toBe('uuid-2');
  });

  it('reset clears state + rotates token', async () => {
    mockFetchOk([{ placeId: 'ChIJ_a', primaryText: 'A', secondaryText: 'B' }]);
    const { result } = renderHook(() => usePlacesAutocomplete({ debounceMs: 10 }));
    act(() => result.current.setQuery('高雄'));
    await waitFor(() => expect(result.current.predictions).toHaveLength(1));

    act(() => result.current.reset());
    expect(result.current.query).toBe('');
    expect(result.current.predictions).toEqual([]);

    act(() => result.current.setQuery('沖繩'));
    await waitFor(() =>
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2),
    );
    const newBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]![1].body);
    expect(newBody.sessionToken).toBe('uuid-2');
  });

  it('fetch failure → error set, predictions stay empty', async () => {
    mockFetchReject(new Error('network'));
    const { result } = renderHook(() => usePlacesAutocomplete({ debounceMs: 10 }));
    act(() => result.current.setQuery('高雄'));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.predictions).toEqual([]);
  });

  it('4xx response → error set', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'DATA_VALIDATION' } }),
    } as unknown as Response);
    const { result } = renderHook(() => usePlacesAutocomplete({ debounceMs: 10 }));
    act(() => result.current.setQuery('高雄'));
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it('clearing query → predictions empty + no fetch', async () => {
    mockFetchOk([{ placeId: 'a', primaryText: 'A', secondaryText: 'B' }]);
    const { result } = renderHook(() => usePlacesAutocomplete({ debounceMs: 10 }));
    act(() => result.current.setQuery('高雄'));
    await waitFor(() => expect(result.current.predictions).toHaveLength(1));
    act(() => result.current.setQuery(''));
    expect(result.current.predictions).toEqual([]);
  });

  it('unmount mid-flight does not crash', async () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(() => undefined), // never resolves
    );
    const { result, unmount } = renderHook(() => usePlacesAutocomplete({ debounceMs: 10 }));
    act(() => result.current.setQuery('高雄'));
    await new Promise((r) => setTimeout(r, 20));
    expect(() => unmount()).not.toThrow();
  });
});
