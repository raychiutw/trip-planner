/**
 * useAutosave — debounce + onBlur + OCC retry 統一 autosave primitive
 *
 * 設計目標：取代 explicit「儲存」button UX，使用者編輯欄位後 800ms debounce 或
 * onBlur 即觸發背景 PATCH，視覺以 `SaveStatus` indicator 取代 button reassurance。
 *
 * 行為：
 *   - patch(updates) → merge into pendingPatch + 重置 debounce timer
 *   - flush() → 立即清 timer + 走 save flow（onBlur / form submit / unmount caller）
 *   - cancel() → 清 timer + 丟 pendingPatch（用於 cancel button 路徑）
 *   - save success → bump version + clear pendingPatch + 'saved' 2s → 'idle'
 *   - 409 STALE_ENTRY → onStale() refresh version + retry once with same patch
 *   - 其他 error → 'error' + 保留 patch 等 manual retry
 *   - offline (networkBus) → 'offline' + 保留 patch，online 重連時 flush 重送
 *
 * OCC：save() 接受 expectedVersion；handler 不符回 409，hook 自動 refresh + retry。
 *
 * 不負責：
 *   - LocalStorage offline queue（A8 task 另作）
 *   - beforeunload guard（caller 自己 wire）— hook 提供 state.hasPending 供 caller 判斷
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerNetworkCallbacks } from '../lib/networkBus';
import { ApiError } from '../lib/errors';

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'offline';

export interface UseAutosaveOptions<T> {
  /** 初始 entity version（OCC）。若 entity 沒 version 欄位 → omit；hook skip OCC。 */
  initialVersion?: number;
  /** Debounce ms。Default 800. */
  debounceMs?: number;
  /**
   * 實際 PATCH 函式。caller 提供，hook call with merged body + expectedVersion。
   * 回傳新 entity（含 version）— hook 取出 .version bump 內部 token。
   */
  save: (body: Partial<T>, expectedVersion: number | undefined) => Promise<Record<string, unknown>>;
  /**
   * STALE_ENTRY refresh hook — 回傳最新 version。caller 通常做 GET 取 latest。
   * 不提供 → 失敗直接顯 error 不 retry。
   */
  onStale?: () => Promise<number>;
  /** 'saved' 狀態自動轉 'idle' 的延遲 (ms). Default 2000. */
  savedDisplayMs?: number;
}

export interface UseAutosaveReturn<T> {
  state: SaveState;
  error: string | null;
  /** 有 pending update 等 save。caller 可用來 beforeunload guard。 */
  hasPending: boolean;
  /** Schedule debounced save with field updates. */
  patch: (updates: Partial<T>) => void;
  /** Force immediate save — onBlur / form submit / unmount. */
  flush: () => Promise<void>;
  /** Discard pending updates (clear timer + drop merged patch). */
  cancel: () => void;
  /** 手動 retry — 失敗後 user click「重試」 button。 */
  retry: () => Promise<void>;
}

export function useAutosave<T extends object>(
  options: UseAutosaveOptions<T>,
): UseAutosaveReturn<T> {
  const { initialVersion, debounceMs = 800, save, onStale, savedDisplayMs = 2000 } = options;

  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hasPending, setHasPending] = useState(false);

  // Stable refs to avoid stale closures in async / setTimeout
  const pendingPatchRef = useRef<Partial<T>>({});
  const versionRef = useRef<number | undefined>(initialVersion);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnlineRef = useRef(true);
  const inFlightRef = useRef(false);
  // 當前 in-flight save 的 promise（finally 內 resolve）。flush() 撞 in-flight 時 await 它，
  // 讓 flush 成為真正 barrier — caller（如 EditEntryPage goBackFocused）await flush 後 PATCH
  // 已 commit，返回時 days GET 才讀得到新值（v2.55.x 桌機備註 stale-on-return 決定性修復）。
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  // 遞迴排程用：finally 內要 re-trigger performSave，但 performSave useCallback 定義時
  // 自己尚未存在 → 透過 ref 取最新版（render body 同步更新）。
  const performSaveRef = useRef<(() => Promise<void>) | null>(null);
  // unmount 後不再排 reschedule timer（save 可能在 unmount 後才 resolve，其 finally
  // 不該在已卸載的 hook 上排新 timer / 再 save，Codex #2）。
  const isMountedRef = useRef(true);

  const clearDebounceTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearSavedTimer = useCallback(() => {
    if (savedTimerRef.current !== null) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }, []);

  /** Perform actual save (call save() + handle response + OCC retry). */
  const performSave = useCallback(async (): Promise<void> => {
    // Snapshot + clear pending — 若 save 期間 user 又 patch，下一輪會接著 save
    const body = pendingPatchRef.current;
    if (Object.keys(body).length === 0) return;
    if (inFlightRef.current) return; // already saving
    if (!isOnlineRef.current) {
      setState('offline');
      return;
    }
    pendingPatchRef.current = {};
    inFlightRef.current = true;
    let resolveInFlight!: () => void;
    inFlightPromiseRef.current = new Promise<void>((r) => { resolveInFlight = r; });
    setState('saving');
    setError(null);
    clearSavedTimer();

    // reschedule（finally）只在 save 成功後觸發；error 路徑保留 pending 等 manual retry，
    // 不可自動重排（否則失敗的 save 會無限重試）。
    let saveSucceeded = false;
    try {
      const result = await save(body, versionRef.current);
      const newVersion = typeof result.version === 'number' ? result.version : undefined;
      if (newVersion !== undefined) versionRef.current = newVersion;
      setHasPending(Object.keys(pendingPatchRef.current).length > 0);
      saveSucceeded = true;
      setState('saved');
      savedTimerRef.current = setTimeout(() => {
        setState((prev) => (prev === 'saved' ? 'idle' : prev));
        savedTimerRef.current = null;
      }, savedDisplayMs);
    } catch (err) {
      // 409 STALE_ENTRY — refresh version + retry once
      if (err instanceof ApiError && err.code === 'STALE_ENTRY' && onStale) {
        try {
          const freshVersion = await onStale();
          versionRef.current = freshVersion;
          // Re-merge dropped patch（user 編輯中 → 仍在 pendingPatchRef）+ original body
          pendingPatchRef.current = { ...body, ...pendingPatchRef.current };
          const retryResult = await save(pendingPatchRef.current, versionRef.current);
          pendingPatchRef.current = {};
          const retryVersion = typeof retryResult.version === 'number' ? retryResult.version : undefined;
          if (retryVersion !== undefined) versionRef.current = retryVersion;
          setHasPending(false);
          saveSucceeded = true;
          setState('saved');
          savedTimerRef.current = setTimeout(() => {
            setState((prev) => (prev === 'saved' ? 'idle' : prev));
            savedTimerRef.current = null;
          }, savedDisplayMs);
          return;
        } catch (retryErr) {
          // Retry 失敗 → 把 body merge 回 pending，user 可手動 retry
          pendingPatchRef.current = { ...body, ...pendingPatchRef.current };
          setHasPending(true);
          setState('error');
          setError(retryErr instanceof Error ? retryErr.message : '儲存衝突，請重新整理');
          return;
        }
      }
      // 其他 error — 保留 patch 等 retry
      pendingPatchRef.current = { ...body, ...pendingPatchRef.current };
      setHasPending(true);
      setState('error');
      setError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      inFlightRef.current = false;
      resolveInFlight();               // 解除 flush() 的 barrier await
      inFlightPromiseRef.current = null;
      // save 期間 user 又 patch（pending 非空）→ 排下一輪 save，達成 line 95 的「下一輪會
      // 接著 save」設計意圖。原本 line 98 in-flight return 後沒 reschedule → 慢請求下 in-flight
      // 期間的最後一次編輯 silently 遺失（Codex #4）。timerRef===null 才排（active timer = user
      // 還在打字、由它接管，避免重複）。
      if (
        saveSucceeded &&
        isMountedRef.current &&
        Object.keys(pendingPatchRef.current).length > 0 &&
        isOnlineRef.current &&
        timerRef.current === null
      ) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          void performSaveRef.current?.();
        }, debounceMs);
      }
    }
  }, [save, onStale, savedDisplayMs, clearSavedTimer, debounceMs]);
  performSaveRef.current = performSave;

  /** Schedule debounced save. */
  const patch = useCallback(
    (updates: Partial<T>): void => {
      pendingPatchRef.current = { ...pendingPatchRef.current, ...updates };
      setHasPending(true);
      setState((prev) => (prev === 'saving' || prev === 'offline' ? prev : 'pending'));
      clearDebounceTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void performSave();
      }, debounceMs);
    },
    [debounceMs, performSave, clearDebounceTimer],
  );

  /** Force immediate save — cancel debounce, fire now. */
  const flush = useCallback(async (): Promise<void> => {
    clearDebounceTimer();
    await performSave();
    // performSave 撞 in-flight（onBlur 已先觸發 save）會即刻 return；補 await 那個 in-flight
    // save，讓 flush 成為真正 barrier（見 inFlightPromiseRef 註解）。
    // performSave 撞 in-flight（onBlur 已先觸發 save）會即刻 return；補 await 那個 in-flight
    // save，讓 flush 成為真正 barrier（見 inFlightPromiseRef 註解）。
    if (inFlightPromiseRef.current) await inFlightPromiseRef.current;
  }, [clearDebounceTimer, performSave]);

  /** Discard pending updates. */
  const cancel = useCallback((): void => {
    clearDebounceTimer();
    pendingPatchRef.current = {};
    setHasPending(false);
    setState('idle');
    setError(null);
  }, [clearDebounceTimer]);

  /** Manual retry after error. */
  const retry = useCallback(async (): Promise<void> => {
    setError(null);
    await performSave();
  }, [performSave]);

  // Wire networkBus — online → flush, offline → state='offline'
  useEffect(() => {
    const unsub = registerNetworkCallbacks(
      // onOffline
      () => {
        isOnlineRef.current = false;
        // Don't override 'saving' or 'saved' transient states
        setState((prev) => (prev === 'pending' || prev === 'error' || prev === 'idle' ? 'offline' : prev));
      },
      // onOnline
      () => {
        isOnlineRef.current = true;
        // 自動 flush 重送
        if (Object.keys(pendingPatchRef.current).length > 0) {
          void performSave();
        } else {
          setState((prev) => (prev === 'offline' ? 'idle' : prev));
        }
      },
    );
    return unsub;
  }, [performSave]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false; // 阻止 in-flight save 的 finally 在卸載後排新 reschedule timer
      clearDebounceTimer();
      clearSavedTimer();
    };
  }, [clearDebounceTimer, clearSavedTimer]);

  return { state, error, hasPending, patch, flush, cancel, retry };
}
