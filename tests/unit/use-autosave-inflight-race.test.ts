// @vitest-environment jsdom
/**
 * useAutosave in-flight 競態（Codex #4 / reservation PR follow-up）。
 *
 * Bug：performSave 在 save 進行中（inFlightRef）直接 return，但 save 完成（finally）後
 * 沒 reschedule 那批被 return 的 pending → 「save 期間 user 又 patch」的最後編輯 silently
 * 遺失（除非 onBlur flush 兜底）。performSave line 95 註解寫「下一輪會接著 save」但實作沒做到。
 *
 * 修復：performSave finally 後，若 pending 非空 + online + 無 active timer → 排下一輪 save。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '../../src/hooks/useAutosave';
import { ApiError } from '../../src/lib/errors';

vi.mock('../../src/lib/networkBus', () => ({
  registerNetworkCallbacks: () => () => {},
}));

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useAutosave — in-flight 競態（Codex #4）', () => {
  it('明確放棄後，晚到的失敗不把已放棄批次放回 pending', async () => {
    const late = deferred<Record<string, unknown>>();
    const save = vi.fn().mockReturnValue(late.promise);
    const { result } = renderHook(() => useAutosave<{ note: string }>({ scopeKey: 'entry', save }));
    act(() => { result.current.patch({ note: '放棄的內容' }); });
    const flush = result.current.flush();
    expect(result.current.hasUnsaved()).toBe(true);
    act(() => { result.current.cancel(); });
    await act(async () => { late.reject(new Error('晚到失敗')); });
    expect(await flush).toBe(false);
    expect(result.current.hasUnsaved()).toBe(false);
    expect(result.current.hasPending).toBe(false);
    expect(result.current.state).toBe('idle');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('放棄 in-flight 批次後的新編輯仍可獨立保存', async () => {
    const late = deferred<Record<string, unknown>>();
    const save = vi.fn().mockReturnValueOnce(late.promise).mockResolvedValueOnce({ version: 3 });
    const { result } = renderHook(() => useAutosave<{ note: string }>({ scopeKey: 'entry', save }));
    act(() => { result.current.patch({ note: '放棄' }); });
    const oldFlush = result.current.flush();
    act(() => { result.current.cancel(); result.current.patch({ note: '新的內容' }); });
    await act(async () => { late.reject(new Error('晚到失敗')); });
    expect(await oldFlush).toBe(false);
    await act(async () => { expect(await result.current.flush()).toBe(true); });
    expect(save).toHaveBeenNthCalledWith(2, { note: '新的內容' }, undefined);
    expect(result.current.hasUnsaved()).toBe(false);
  });

  it('切換 entity 後舊回覆不改新 entity 的 pending、版本或結果', async () => {
    const oldSave = deferred<Record<string, unknown>>();
    const saveA = vi.fn().mockReturnValue(oldSave.promise);
    const saveB = vi.fn().mockResolvedValueOnce({ version: 11 }).mockResolvedValueOnce({ version: 12 });
    const { result, rerender } = renderHook(
      ({ scopeKey, initialVersion, save }) => useAutosave<{ note: string }>({
        scopeKey, initialVersion, save, debounceMs: 800,
      }),
      { initialProps: { scopeKey: 'trip-A:entry-1', initialVersion: 1, save: saveA } },
    );

    act(() => { result.current.patch({ note: 'A 的值' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    rerender({ scopeKey: 'trip-B:entry-1', initialVersion: 10, save: saveB });
    act(() => { result.current.patch({ note: 'B 的值' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(saveB).toHaveBeenCalledWith({ note: 'B 的值' }, 10);

    await act(async () => { oldSave.resolve({ version: 2 }); });
    act(() => { result.current.patch({ note: 'B 的後續值' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(saveB).toHaveBeenLastCalledWith({ note: 'B 的後續值' }, 11);
    expect(result.current.hasPending).toBe(false);
  });

  it('A→B→A 保留 A 尚未送出的編輯，回來後才用 A 的版本儲存', async () => {
    const saveA = vi.fn().mockResolvedValue({ version: 2 });
    const saveB = vi.fn().mockResolvedValue({ version: 11 });
    const { result, rerender } = renderHook(
      ({ scopeKey, initialVersion, save }) => useAutosave<{ note: string }>({
        scopeKey, initialVersion, save, debounceMs: 800,
      }),
      { initialProps: { scopeKey: 'trip-A:entry-1', initialVersion: 1, save: saveA } },
    );

    act(() => { result.current.patch({ note: 'A 待存' }); });
    rerender({ scopeKey: 'trip-B:entry-1', initialVersion: 10, save: saveB });
    expect(result.current.hasPending).toBe(false);
    rerender({ scopeKey: 'trip-A:entry-1', initialVersion: 1, save: saveA });
    expect(result.current.hasPending).toBe(true);
    await act(async () => { expect(await result.current.flush()).toBe(true); });
    expect(saveA).toHaveBeenCalledWith({ note: 'A 待存' }, 1);
    expect(saveB).not.toHaveBeenCalled();
  });

  it('切到 B 後 A 已排程的儲存仍送到 A，晚到結果不改 B 顯示', async () => {
    const saveA = vi.fn().mockResolvedValue({ version: 2 });
    const saveB = vi.fn().mockResolvedValue({ version: 11 });
    const { result, rerender } = renderHook(
      ({ scopeKey, initialVersion, save }) => useAutosave<{ note: string }>({
        scopeKey, initialVersion, save, debounceMs: 800,
      }),
      { initialProps: { scopeKey: 'trip-A:entry-1', initialVersion: 1, save: saveA } },
    );

    act(() => { result.current.patch({ note: 'A 的待存值' }); });
    rerender({ scopeKey: 'trip-B:entry-1', initialVersion: 10, save: saveB });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(saveA).toHaveBeenCalledWith({ note: 'A 的待存值' }, 1);
    expect(result.current.state).toBe('idle');

    act(() => { result.current.patch({ note: 'B 的值' }); });
    await act(async () => { expect(await result.current.flush()).toBe(true); });
    expect(saveB).toHaveBeenCalledWith({ note: 'B 的值' }, 10);
  });
  it('OCC 重試只消耗自己的批次，重試期間的新編輯接著儲存', async () => {
    const retry = deferred<Record<string, unknown>>();
    const save = vi.fn()
      .mockRejectedValueOnce(new ApiError('STALE_ENTRY', 409))
      .mockReturnValueOnce(retry.promise)
      .mockResolvedValueOnce({ version: 5 });
    const { result } = renderHook(() => useAutosave<{ note: string }>({
      debounceMs: 800,
      initialVersion: 2,
      scopeKey: 'test-entry',
      save,
      onStale: async () => 3,
    }));

    act(() => { result.current.patch({ note: '第一版' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(save).toHaveBeenNthCalledWith(2, { note: '第一版' }, 3);

    act(() => { result.current.patch({ note: '重試期間的新值' }); });
    await act(async () => { retry.resolve({ version: 4 }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });

    expect(save).toHaveBeenNthCalledWith(3, { note: '重試期間的新值' }, 4);
    expect(result.current.hasPending).toBe(false);
  });

  it('OCC 重試失敗保留同欄新值及異欄舊值，flush 回報未存後仍可重試', async () => {
    const conflictRetry = deferred<Record<string, unknown>>();
    const save = vi.fn()
      .mockRejectedValueOnce(new ApiError('STALE_ENTRY', 409))
      .mockReturnValueOnce(conflictRetry.promise)
      .mockResolvedValueOnce({ version: 4 });
    const { result } = renderHook(() => useAutosave<{ note: string; description: string }>({
      scopeKey: 'test-entry', initialVersion: 1, debounceMs: 800, save,
      onStale: async () => 3,
    }));

    act(() => { result.current.patch({ note: '舊備註', description: '保留說明' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    act(() => { result.current.patch({ note: '新備註' }); });
    const flush = result.current.flush();
    await act(async () => { conflictRetry.reject(new Error('暫時故障')); });
    expect(await flush).toBe(false);
    expect(result.current.state).toBe('error');
    expect(result.current.hasPending).toBe(true);

    await act(async () => { await result.current.retry(); });
    expect(save).toHaveBeenNthCalledWith(3, { note: '新備註', description: '保留說明' }, 3);
    expect(result.current.hasPending).toBe(false);
  });

  it('flush 等待呼叫時已接受的較新批次，不把前一批完成當作全部已存', async () => {
    const first = deferred<Record<string, unknown>>();
    const second = deferred<Record<string, unknown>>();
    const save = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useAutosave<{ note: string }>({ scopeKey: 'test-entry', debounceMs: 800, save }));

    act(() => { result.current.patch({ note: '第一批' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    act(() => { result.current.patch({ note: '第二批' }); });
    let flushed = false;
    const flush = result.current.flush().then(() => { flushed = true; });

    await act(async () => { first.resolve({ version: 2 }); });
    expect(flushed).toBe(false);
    expect(result.current.state).toBe('saving');
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(save).toHaveBeenNthCalledWith(2, { note: '第二批' }, 2);
    await act(async () => { second.resolve({ version: 3 }); await flush; });
    expect(flushed).toBe(true);
  });

  it('取消待送新值後，flush 只等已送批次，不把已取消的值當未存', async () => {
    const first = deferred<Record<string, unknown>>();
    const save = vi.fn().mockReturnValue(first.promise);
    const { result } = renderHook(() => useAutosave<{ note: string }>({ scopeKey: 'test-entry', debounceMs: 800, save }));

    act(() => { result.current.patch({ note: '已送' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    act(() => { result.current.patch({ note: '取消' }); result.current.cancel(); });
    await act(async () => { first.resolve({ version: 2 }); });
    expect(await result.current.flush()).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('save 進行中再 patch → save 完成後接著存第二批（不遺失最後編輯）', async () => {
    const d1 = deferred<Record<string, unknown>>();
    const d2 = deferred<Record<string, unknown>>();
    const save = vi.fn<(b: Partial<{ note: string }>, v: number | undefined) => Promise<Record<string, unknown>>>()
      .mockReturnValueOnce(d1.promise)
      .mockReturnValueOnce(d2.promise);
    const { result } = renderHook(() => useAutosave<{ note: string }>({ scopeKey: 'test-entry', debounceMs: 800, save }));

    // 第一批 → debounce fire → save in-flight（尚未 resolve）
    act(() => { result.current.patch({ note: 'A' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith({ note: 'A' }, undefined);

    // save 尚未回 → 第二批 patch；新 debounce fire 撞 inFlight → return
    act(() => { result.current.patch({ note: 'B' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(save).toHaveBeenCalledTimes(1); // 第二輪被 in-flight return

    // 第一個 save 完成 → 修復後 finally reschedule 第二批
    await act(async () => { d1.resolve({ version: 2 }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ note: 'B' }, 2); // 第二批，用 save 回的新 version

    await act(async () => { d2.resolve({ version: 3 }); });
  });

  it('save 完成時無 pending → 不多餘 reschedule', async () => {
    const d1 = deferred<Record<string, unknown>>();
    const save = vi.fn<(b: Partial<{ note: string }>, v: number | undefined) => Promise<Record<string, unknown>>>()
      .mockReturnValueOnce(d1.promise);
    const { result } = renderHook(() => useAutosave<{ note: string }>({ scopeKey: 'test-entry', debounceMs: 800, save }));

    act(() => { result.current.patch({ note: 'A' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    await act(async () => { d1.resolve({ version: 2 }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(save).toHaveBeenCalledTimes(1); // 無 pending → 不重排
  });

  it('save 失敗 → 保留 pending 等 manual retry，不自動重排（避免無限重試）', async () => {
    const save = vi.fn<(b: Partial<{ note: string }>, v: number | undefined) => Promise<Record<string, unknown>>>()
      .mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAutosave<{ note: string }>({ scopeKey: 'test-entry', debounceMs: 800, save }));

    act(() => { result.current.patch({ note: 'A' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('error');
    expect(result.current.hasPending).toBe(true); // pending 保留等 manual retry
    // 不自動重排：再推進時間不會再 call save（否則無限重試失敗的 save）
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('送出時有新編輯且送出失敗，舊 debounce 不偷偷重試', async () => {
    const first = deferred<Record<string, unknown>>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue({ version: 2 });
    const { result } = renderHook(() => useAutosave<{ note: string }>({ scopeKey: 'test-entry', debounceMs: 800, save }));

    act(() => { result.current.patch({ note: '舊值' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    act(() => { result.current.patch({ note: '新值' }); });
    await act(async () => { first.reject(new Error('暫時故障')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('error');
    expect(result.current.hasPending).toBe(true);
  });

  it('unmount 後 in-flight save resolve → 不排新 reschedule timer（Codex #2）', async () => {
    const d1 = deferred<Record<string, unknown>>();
    const save = vi.fn<(b: Partial<{ note: string }>, v: number | undefined) => Promise<Record<string, unknown>>>()
      .mockReturnValueOnce(d1.promise);
    const { result, unmount } = renderHook(() => useAutosave<{ note: string }>({ scopeKey: 'test-entry', debounceMs: 800, save }));

    act(() => { result.current.patch({ note: 'A' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); }); // save in-flight
    act(() => { result.current.patch({ note: 'B' }); }); // in-flight 期間 patch（pending 非空）
    unmount(); // save 仍 in-flight → cleanup 設 isMountedRef=false

    await act(async () => { d1.resolve({ version: 2 }); }); // finally 不該排新 timer
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(save).toHaveBeenCalledTimes(1); // 卸載後不 reschedule
    expect(vi.getTimerCount()).toBe(0);
  });

  it('flush() 撞 in-flight save → await 到 save resolve 才完成（barrier，桌機備註 stale-on-return 修）', async () => {
    const d1 = deferred<Record<string, unknown>>();
    const save = vi.fn<(b: Partial<{ note: string }>, v: number | undefined) => Promise<Record<string, unknown>>>()
      .mockReturnValueOnce(d1.promise);
    const { result } = renderHook(() => useAutosave<{ note: string }>({ scopeKey: 'test-entry', debounceMs: 800, save }));

    // patch → debounce fire → save in-flight（模擬 onBlur 已先觸發 PATCH，尚未 resolve）
    act(() => { result.current.patch({ note: 'A' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(save).toHaveBeenCalledTimes(1);

    // flush()：pending 已空但 save 仍 in-flight → 必須 await 到 save resolve 才 resolve（barrier）。
    // 修復前 flush 撞空 body 即刻 return → flushed 會提早 true（此測試會紅）。
    let flushed = false;
    await act(async () => {
      const p = result.current.flush().then(() => { flushed = true; });
      await Promise.resolve();
      await Promise.resolve();
      expect(flushed).toBe(false); // save 未 resolve → flush 卡在 barrier
      d1.resolve({ version: 2 });
      await p;
    });
    expect(flushed).toBe(true); // save resolve 後 flush 才放行
  });
});
