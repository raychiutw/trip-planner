/** 側邊欄「我的行程」清單請求帶逾時 signal；逾時轉成 error 態、可重試（#1688）。 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
  apiFetchRaw: vi.fn(),
}));

import { useMyTrips, refreshMyTrips, __clearMyTripsCache } from '../../src/hooks/useMyTrips';

beforeEach(() => { apiFetchMock.mockReset(); __clearMyTripsCache(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('useMyTrips 逾時', () => {
  it('帶逾時 signal；abort 後 status=error，重試可恢復', async () => {
    const ctl = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(ctl.signal);
    apiFetchMock.mockImplementationOnce((_p, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('timeout')));
    }));
    const { result } = renderHook(() => useMyTrips('u1'));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(timeout).toHaveBeenCalled();
    expect(apiFetchMock.mock.calls[0]![1]?.signal).toBe(ctl.signal);
    expect(result.current.status).toBe('loading');

    ctl.abort();
    await waitFor(() => expect(result.current.status).toBe('error'));

    timeout.mockRestore();
    apiFetchMock.mockResolvedValueOnce([{ tripId: 't1', name: 'A' }]);
    act(() => { refreshMyTrips(); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});
