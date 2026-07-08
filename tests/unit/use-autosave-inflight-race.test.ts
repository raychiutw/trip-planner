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

vi.mock('../../src/lib/networkBus', () => ({
  registerNetworkCallbacks: () => () => {},
}));

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useAutosave — in-flight 競態（Codex #4）', () => {
  it('save 進行中再 patch → save 完成後接著存第二批（不遺失最後編輯）', async () => {
    const d1 = deferred<Record<string, unknown>>();
    const d2 = deferred<Record<string, unknown>>();
    const save = vi.fn<(b: Partial<{ note: string }>, v: number | undefined) => Promise<Record<string, unknown>>>()
      .mockReturnValueOnce(d1.promise)
      .mockReturnValueOnce(d2.promise);
    const { result } = renderHook(() => useAutosave<{ note: string }>({ debounceMs: 800, save }));

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
    const { result } = renderHook(() => useAutosave<{ note: string }>({ debounceMs: 800, save }));

    act(() => { result.current.patch({ note: 'A' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    await act(async () => { d1.resolve({ version: 2 }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(save).toHaveBeenCalledTimes(1); // 無 pending → 不重排
  });

  it('save 失敗 → 保留 pending 等 manual retry，不自動重排（避免無限重試）', async () => {
    const save = vi.fn<(b: Partial<{ note: string }>, v: number | undefined) => Promise<Record<string, unknown>>>()
      .mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAutosave<{ note: string }>({ debounceMs: 800, save }));

    act(() => { result.current.patch({ note: 'A' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('error');
    expect(result.current.hasPending).toBe(true); // pending 保留等 manual retry
    // 不自動重排：再推進時間不會再 call save（否則無限重試失敗的 save）
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('unmount 後 in-flight save resolve → 不排新 reschedule timer（Codex #2）', async () => {
    const d1 = deferred<Record<string, unknown>>();
    const save = vi.fn<(b: Partial<{ note: string }>, v: number | undefined) => Promise<Record<string, unknown>>>()
      .mockReturnValueOnce(d1.promise);
    const { result, unmount } = renderHook(() => useAutosave<{ note: string }>({ debounceMs: 800, save }));

    act(() => { result.current.patch({ note: 'A' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); }); // save in-flight
    act(() => { result.current.patch({ note: 'B' }); }); // in-flight 期間 patch（pending 非空）
    unmount(); // save 仍 in-flight → cleanup 設 isMountedRef=false

    await act(async () => { d1.resolve({ version: 2 }); }); // finally 不該排新 timer
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(save).toHaveBeenCalledTimes(1); // 卸載後不 reschedule
  });

  it('flush() 撞 in-flight save → await 到 save resolve 才完成（barrier，桌機備註 stale-on-return 修）', async () => {
    const d1 = deferred<Record<string, unknown>>();
    const save = vi.fn<(b: Partial<{ note: string }>, v: number | undefined) => Promise<Record<string, unknown>>>()
      .mockReturnValueOnce(d1.promise);
    const { result } = renderHook(() => useAutosave<{ note: string }>({ debounceMs: 800, save }));

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
