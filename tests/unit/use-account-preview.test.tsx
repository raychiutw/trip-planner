/** useAccountPreview：GET /account 的單一請求、失敗可重試、競態不讓舊回應覆蓋新回應。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const apiFetchMock = vi.fn<(path: string) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({ apiFetch: (path: string) => apiFetchMock(path) }));

import { useAccountPreview } from '../../src/hooks/useAccountPreview';

const preview = (tripsOwned: number, hasPassword = true) => ({
  hasPassword, reauthProvider: hasPassword ? null : 'google', reauthenticated: false, tripsOwned, collaboratorsAffected: 0,
});
function deferred<T>() {
  let resolve!: (v: T) => void; let reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}

beforeEach(() => { apiFetchMock.mockReset(); });

describe('useAccountPreview', () => {
  it('autoLoad：掛載就取一次', async () => {
    apiFetchMock.mockResolvedValue(preview(2));
    const { result } = renderHook(() => useAccountPreview(true));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.preview?.tripsOwned).toBe(2);
  });

  it('autoLoad 關閉：不主動取；reload() 才取', async () => {
    apiFetchMock.mockResolvedValue(preview(1));
    const { result } = renderHook(() => useAccountPreview(false));
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    let got: unknown;
    await act(async () => { got = await result.current.reload(); });
    expect(got).toMatchObject({ tripsOwned: 1 });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('失敗 → status=error；reload() 重試成功後 ready', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(preview(3));
    const { result } = renderHook(() => useAccountPreview(true));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.preview).toBeNull();
    act(() => { void result.current.reload(); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.preview?.tripsOwned).toBe(3);
  });

  it('格式不符的回應視為失敗', async () => {
    apiFetchMock.mockResolvedValue({ hasPassword: 'yes' });
    const { result } = renderHook(() => useAccountPreview(true));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('競態：reload() 發出的新請求先回來，舊請求晚到也不覆蓋', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useAccountPreview(true));
    act(() => { void result.current.reload(); });
    await act(async () => { second.resolve(preview(9)); await Promise.resolve(); });
    await waitFor(() => expect(result.current.preview?.tripsOwned).toBe(9));
    await act(async () => { first.resolve(preview(1)); await Promise.resolve(); });
    expect(result.current.preview?.tripsOwned).toBe(9);
    expect(result.current.status).toBe('ready');
  });

  it('舊請求失敗晚到，也不會把新請求的成功結果蓋成 error', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useAccountPreview(true));
    act(() => { void result.current.reload(); });
    await act(async () => { second.resolve(preview(4)); await Promise.resolve(); });
    await act(async () => { first.reject(new Error('late')); await Promise.resolve(); });
    expect(result.current.status).toBe('ready');
    expect(result.current.preview?.tripsOwned).toBe(4);
  });

  it('patch()：就地修改已載入的預覽（刪除流程標記 reauthenticated=false）', async () => {
    apiFetchMock.mockResolvedValue({ ...preview(1, false), reauthenticated: true });
    const { result } = renderHook(() => useAccountPreview(true));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.patch((p) => ({ ...p, reauthenticated: false })));
    expect(result.current.preview?.reauthenticated).toBe(false);
  });
});
