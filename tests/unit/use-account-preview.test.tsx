/** useAccountPreview：GET /account 的單一請求、失敗可重試、競態不讓舊回應覆蓋新回應。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const apiFetchMock = vi.fn<(path: string) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({ apiFetch: (path: string) => apiFetchMock(path) }));

import { useAccountPreview } from '../../src/hooks/useAccountPreview';

const preview = (tripsOwned: number, hasPassword = true) => ({
  hasPassword, tripsOwned, collaboratorsAffected: 0,
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

  it('reload() 對進行中的請求去重：同時多次呼叫只打一次、回傳同一份結果', async () => {
    const d = deferred<unknown>();
    apiFetchMock.mockReturnValueOnce(d.promise);
    const { result } = renderHook(() => useAccountPreview(true));
    let a: unknown; let b: unknown;
    act(() => { void result.current.reload().then((v) => { a = v; }); void result.current.reload().then((v) => { b = v; }); });
    await act(async () => { d.resolve(preview(5)); await d.promise; });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(result.current.preview?.tripsOwned).toBe(5);
  });

  it('已載入之後 reload() 失敗：保留既有預覽（status=error 但 preview 不清）', async () => {
    apiFetchMock.mockResolvedValueOnce(preview(7)).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAccountPreview(true));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let got: unknown = 'x';
    await act(async () => { got = await result.current.reload(); });
    expect(got).toBeNull();
    expect(result.current.status).toBe('error');
    expect(result.current.preview?.tripsOwned).toBe(7);
  });
});
