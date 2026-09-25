import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useExploreResults } from '../../src/hooks/useExploreResults';

const read = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/apiClient', () => ({ apiFetch: read }));

it('an observer retaining the pre-failure callback cannot automatically retry a failed page', async () => {
  const poi = (id: string) => ({ place_id: id, name: id, lat: 25, lng: 121 });
  read.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ results: [poi('B')] });
  const { result } = renderHook(() => useExploreResults({
    query: 'Tokyo', region: '全部地區', results: [poi('A')], nextPageToken: 'next', pagesLoaded: 1,
  }));
  const observerCallback = result.current.loadMore;
  await act(async () => { await observerCallback(true); });
  expect(result.current.moreError).toBeTruthy();
  await act(async () => { await observerCallback(true); });
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.loadMore(); });
  expect(read).toHaveBeenCalledTimes(2);
  expect(result.current.snapshot.results.map(p => p.place_id)).toEqual(['A', 'B']);
});
