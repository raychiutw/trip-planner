import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePoiFavorites, usePoiFavorites } from '../../src/hooks/usePoiFavorites';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn<(path: string) => Promise<unknown>>() }));
vi.mock('../../src/lib/apiClient', () => ({ apiFetch }));

beforeEach(() => apiFetch.mockReset());

describe('usePoiFavorites', () => {
  it('preserves camelCase metadata and drops malformed rows', () => {
    expect(normalizePoiFavorites([
      { id: 1, poiId: 9, poiName: '東京塔', poiAddress: '東京', poiType: 'attraction', poiRating: 4.5 },
      { id: 2, poi_id: 10, poi_name: 'old shape' },
    ])).toMatchObject([{ id: 1, poiId: 9, poiName: '東京塔', poiRating: 4.5 }]);
    expect(() => normalizePoiFavorites([{ id: 2, poi_id: 10, poi_name: 'old shape' }])).toThrow('Invalid favorites response');
  });

  it('reports failure, retries, and ignores a response after the tab is left', async () => {
    let finish!: (value: unknown) => void;
    apiFetch.mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(({ enabled }) => usePoiFavorites(enabled), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    act(() => result.current.retry());
    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    rerender({ enabled: false });
    await act(async () => finish([{ id: 1, poiId: 9, poiName: 'late' }]));
    expect(result.current.state.status).toBe('loading');
    rerender({ enabled: true });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3));
  });
});
