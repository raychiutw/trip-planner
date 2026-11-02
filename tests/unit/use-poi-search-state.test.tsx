import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePoiSearch } from '../../src/hooks/usePoiSearch';

const apiFetchRaw = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>();
vi.mock('../../src/lib/apiClient', () => ({ apiFetchRaw: (path: string, init?: RequestInit) => apiFetchRaw(path, init) }));

const poi = (name: string) => ({ place_id: name, name, lat: 1, lng: 2 });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => apiFetchRaw.mockReset());

describe('usePoiSearch current result', () => {
  it('離線後手動重試同一查詢', async () => {
    apiFetchRaw.mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(async () => json({ results: [poi('東京')] }));
    const { result } = renderHook(() => usePoiSearch({ query: 'tokyo', debounceMs: 0 }));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.error).toBe('network-error');
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.results[0]?.name).toBe('東京'));
    expect(apiFetchRaw).toHaveBeenCalledTimes(2);
  });

  it('直接解析 POI search API 的 results 回應', async () => {
    apiFetchRaw.mockResolvedValue(json({ results: [poi('東京')] }));
    const { result } = renderHook(() => usePoiSearch({ query: 'tokyo', debounceMs: 0 }));
    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(result.current.state.results[0]?.name).toBe('東京');
  });

  it('短 query 不查；query 與 region 改變時立即隔離舊結果，晚到的舊回覆不能覆寫', async () => {
    let finishOld!: (value: Response) => void;
    apiFetchRaw.mockImplementation((path) => path?.includes('region=JP')
      ? new Promise((resolve) => { finishOld = resolve; })
      : Promise.resolve(json([poi('台北')])));
    const { result, rerender } = renderHook(
      ({ query, region }) => usePoiSearch({ query, region, debounceMs: 0 }),
      { initialProps: { query: 'a', region: 'JP' } },
    );
    expect(result.current.state.status).toBe('idle');
    expect(apiFetchRaw).not.toHaveBeenCalled();
    rerender({ query: 'tokyo', region: 'JP' });
    await waitFor(() => expect(apiFetchRaw).toHaveBeenCalledTimes(1));
    rerender({ query: 'taipei', region: 'TW' });
    expect(result.current.state.status).toBe('loading');
    expect(result.current.state.results).toEqual([]);
    await waitFor(() => expect(result.current.state.results[0]?.name).toBe('台北'));
    await act(async () => finishOld(json([poi('東京')])));
    expect(result.current.state.results[0]?.name).toBe('台北');
    expect(apiFetchRaw.mock.calls[1]?.[0]).toContain('region=TW');
    rerender({ query: 'a', region: 'TW' });
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.results).toEqual([]);
  });

  it('新查詢不沿用舊錯誤；disabled 隱藏舊狀態，恢復後重新查詢', async () => {
    apiFetchRaw.mockImplementationOnce(async () => json({}, 503))
      .mockImplementation(async () => json({ results: [] }));
    const rendered: Array<'idle' | 'loading' | 'success' | 'error'> = [];
    const { result, rerender } = renderHook(
      ({ query, enabled }) => {
        const search = usePoiSearch({ query, enabled, debounceMs: 0 });
        rendered.push(search.state.status);
        return search;
      },
      { initialProps: { query: 'tokyo', enabled: true } },
    );
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    rerender({ query: 'osaka', enabled: true });
    expect(result.current.state.status).toBe('loading');
    expect(result.current.state.error).toBeNull();
    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(result.current.state.results).toEqual([]);
    const beforeReturningToTokyo = rendered.length;
    rerender({ query: 'tokyo', enabled: true });
    expect(rendered[beforeReturningToTokyo]).toBe('loading');
    expect(result.current.state.status).toBe('loading');
    expect(result.current.state.error).toBeNull();
    await waitFor(() => expect(apiFetchRaw).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.state.status).toBe('success'));
    rerender({ query: 'osaka', enabled: false });
    expect(result.current.state.status).toBe('idle');
    rerender({ query: 'osaka', enabled: true });
    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(apiFetchRaw).toHaveBeenCalledTimes(4));
  });
});
