/**
 * useAutosave — debounce + onBlur + OCC retry 統一 autosave primitive
 *
 * 設計目標：取代 explicit「儲存」button UX，使用者編輯欄位後 800ms debounce 或
 * onBlur 即觸發背景 PATCH，視覺以 `SaveStatus` indicator 取代 button reassurance。
 *
 * 行為：
 *   - scopeKey 分開保存各 entity 的 pending、版本與結果；切換後舊回覆只更新舊 scope
 *   - patch(updates) → merge into current scope pending + 重置 debounce timer
 *   - flush() → 立即清 timer + 走 save flow（onBlur / form submit / unmount caller）
 *   - cancel() → 清 timer + 丟 pendingPatch（用於 cancel button 路徑）
 *   - save success → bump version；只消耗已送批次，沒有新 pending 才顯示 'saved'
 *   - 409 STALE_ENTRY → onStale() refresh version + retry once with same patch
 *   - 其他 error → 'error' + 保留 patch 等 manual retry
 *   - offline (networkBus) → 'offline' + 保留 patch，online 重連時 flush 重送
 *
 * OCC：save() 接受 expectedVersion；handler 不符回 409，hook 自動 refresh + retry。
 *
 * 不負責：
 *   - LocalStorage offline queue（A8 task 另作）
 *   - beforeunload guard（caller 自己 wire）— hook 提供 hasUnsaved() 供 caller 判斷
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { registerNetworkCallbacks } from '../lib/networkBus';
import { ApiError } from '../lib/errors';

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'offline';

export interface UseAutosaveOptions<T> {
  /** Stable identity of the entity and field group being saved. */
  scopeKey: string;
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
  /** Current accepted edits not yet confirmed saved, including an in-flight batch. */
  hasUnsaved: () => boolean;
  /** Schedule debounced save with field updates. */
  patch: (updates: Partial<T>) => void;
  /** Force save on blur/submit; true only when this call's accepted edits are saved. */
  flush: () => Promise<boolean>;
  /** Discard pending updates (clear timer + drop merged patch). */
  cancel: () => void;
  /** 手動 retry — 失敗後 user click「重試」 button。 */
  retry: () => Promise<void>;
}

interface SaveScope<T extends object> {
  key: string;
  pending: Partial<T>;
  acceptedRevision: number;
  savedRevision: number;
  sendingRevision: number;
  discardGeneration: number;
  version: number | undefined;
  inFlight: Promise<boolean> | null;
  timer: ReturnType<typeof setTimeout> | null;
  savedTimer: ReturnType<typeof setTimeout> | null;
  state: SaveState;
  error: string | null;
}

export function useAutosave<T extends object>(
  options: UseAutosaveOptions<T>,
): UseAutosaveReturn<T> {
  const { scopeKey, initialVersion, debounceMs = 800, save, onStale, savedDisplayMs = 2000 } = options;
  // ponytail: scopes live for this hook instance; evict clean scopes if one mounted row visits unbounded entities.
  const scopesRef = useRef<Map<string, SaveScope<T>>>(new Map());
  let renderScope = scopesRef.current.get(scopeKey);
  if (!renderScope) {
    renderScope = {
      key: scopeKey, pending: {}, acceptedRevision: 0, savedRevision: 0, sendingRevision: 0, discardGeneration: 0,
      version: initialVersion, inFlight: null, timer: null, savedTimer: null,
      state: 'idle', error: null,
    };
    scopesRef.current.set(scopeKey, renderScope);
  }
  const activeScopeRef = useRef(renderScope);
  const [state, setState] = useState<SaveState>(renderScope.state);
  const [error, setError] = useState<string | null>(renderScope.error);
  const [hasPending, setHasPending] = useState(Object.keys(renderScope.pending).length > 0);
  const isOnlineRef = useRef(true);
  const isMountedRef = useRef(true);
  const performSaveRef = useRef<((scope: SaveScope<T>) => Promise<boolean>) | null>(null);

  const publish = useCallback((scope: SaveScope<T>) => {
    if (!isMountedRef.current || activeScopeRef.current !== scope) return;
    setState(scope.state);
    setError(scope.error);
    setHasPending(Object.keys(scope.pending).length > 0);
  }, []);

  const clearDebounceTimer = useCallback((scope: SaveScope<T>) => {
    if (scope.timer !== null) clearTimeout(scope.timer);
    scope.timer = null;
  }, []);
  const clearSavedTimer = useCallback((scope: SaveScope<T>) => {
    if (scope.savedTimer !== null) clearTimeout(scope.savedTimer);
    scope.savedTimer = null;
  }, []);

  useLayoutEffect(() => {
    if (activeScopeRef.current === renderScope) return;
    activeScopeRef.current = renderScope;
    publish(renderScope);
    if (Object.keys(renderScope.pending).length > 0 && !renderScope.inFlight &&
        renderScope.timer === null && isOnlineRef.current) {
      renderScope.timer = setTimeout(() => {
        renderScope.timer = null;
        void performSaveRef.current?.(renderScope);
      }, debounceMs);
    }
  }, [renderScope, debounceMs, publish]);

  const performSave = useCallback(async (scope: SaveScope<T>): Promise<boolean> => {
    const body = scope.pending;
    if (Object.keys(body).length === 0) return true;
    if (scope.inFlight) return false;
    if (!isOnlineRef.current) {
      scope.state = 'offline';
      publish(scope);
      return false;
    }

    const bodyRevision = scope.acceptedRevision;
    const discardGeneration = scope.discardGeneration;
    scope.sendingRevision = bodyRevision;
    scope.pending = {};
    let resolveInFlight!: (saved: boolean) => void;
    scope.inFlight = new Promise<boolean>((resolve) => { resolveInFlight = resolve; });
    scope.state = 'saving';
    scope.error = null;
    clearSavedTimer(scope);
    publish(scope);

    let saveSucceeded = false;
    const complete = (result: Record<string, unknown>) => {
      if (typeof result.version === 'number') scope.version = result.version;
      if (scope.discardGeneration !== discardGeneration) {
        scope.state = Object.keys(scope.pending).length > 0 ? 'pending' : 'idle';
        publish(scope);
        return false;
      }
      scope.savedRevision = bodyRevision;
      saveSucceeded = true;
      scope.state = Object.keys(scope.pending).length > 0 ? 'pending' : 'saved';
      if (scope.state === 'saved' && isMountedRef.current) {
        scope.savedTimer = setTimeout(() => {
          if (scope.state === 'saved') scope.state = 'idle';
          scope.savedTimer = null;
          publish(scope);
        }, savedDisplayMs);
      }
      publish(scope);
      return true;
    };
    const fail = (reason: unknown, fallback: string) => {
      if (scope.discardGeneration !== discardGeneration) {
        scope.state = Object.keys(scope.pending).length > 0 ? 'pending' : 'idle';
        publish(scope);
        return false;
      }
      clearDebounceTimer(scope);
      scope.pending = { ...body, ...scope.pending };
      scope.state = 'error';
      scope.error = reason instanceof Error ? reason.message : fallback;
      publish(scope);
      return false;
    };

    try {
      return complete(await save(body, scope.version));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STALE_ENTRY' && onStale) {
        try {
          scope.version = await onStale();
          // The retry owns only body; edits accepted during either request stay pending.
          return complete(await save(body, scope.version));
        } catch (retryErr) {
          return fail(retryErr, '儲存衝突，請重新整理');
        }
      }
      return fail(err, '儲存失敗');
    } finally {
      scope.inFlight = null;
      resolveInFlight(saveSucceeded);
      if (
        (saveSucceeded || scope.discardGeneration !== discardGeneration) && isMountedRef.current &&
        Object.keys(scope.pending).length > 0 && isOnlineRef.current && scope.timer === null
      ) {
        scope.timer = setTimeout(() => {
          scope.timer = null;
          void performSave(scope);
        }, debounceMs);
      }
    }
  }, [save, onStale, savedDisplayMs, debounceMs, clearDebounceTimer, clearSavedTimer, publish]);
  performSaveRef.current = performSave;

  const patch = useCallback((updates: Partial<T>): void => {
    const scope = activeScopeRef.current;
    if (scope.key !== scopeKey) return;
    scope.pending = { ...scope.pending, ...updates };
    scope.acceptedRevision += 1;
    scope.state = scope.state === 'saving' || scope.state === 'offline' ? scope.state : 'pending';
    publish(scope);
    clearDebounceTimer(scope);
    scope.timer = setTimeout(() => {
      scope.timer = null;
      void performSave(scope);
    }, debounceMs);
  }, [scopeKey, debounceMs, publish, clearDebounceTimer, performSave]);

  const flush = useCallback(async (): Promise<boolean> => {
    const scope = activeScopeRef.current;
    if (scope.key !== scopeKey) return false;
    const targetRevision = scope.acceptedRevision;
    while (scope.savedRevision < targetRevision) {
      clearDebounceTimer(scope);
      const inFlight = scope.inFlight;
      if (inFlight) {
        if (!(await inFlight)) return false;
      } else if (Object.keys(scope.pending).length === 0 || !(await performSave(scope))) {
        return false;
      }
    }
    return activeScopeRef.current === scope;
  }, [scopeKey, clearDebounceTimer, performSave]);

  const hasUnsaved = useCallback((): boolean => {
    const scope = activeScopeRef.current;
    return scope.key === scopeKey && scope.acceptedRevision > scope.savedRevision;
  }, [scopeKey]);

  const cancel = useCallback((): void => {
    const scope = activeScopeRef.current;
    if (scope.key !== scopeKey) return;
    clearDebounceTimer(scope);
    scope.discardGeneration += 1;
    scope.pending = {};
    if (scope.inFlight) scope.savedRevision = Math.max(scope.savedRevision, scope.sendingRevision);
    scope.acceptedRevision = scope.savedRevision;
    scope.state = 'idle';
    scope.error = null;
    publish(scope);
  }, [scopeKey, clearDebounceTimer, publish]);

  const retry = useCallback(async (): Promise<void> => {
    const scope = activeScopeRef.current;
    if (scope.key !== scopeKey) return;
    scope.error = null;
    publish(scope);
    await performSave(scope);
  }, [scopeKey, performSave, publish]);

  useEffect(() => {
    const unsub = registerNetworkCallbacks(
      () => {
        isOnlineRef.current = false;
        const scope = activeScopeRef.current;
        if (scope.state === 'pending' || scope.state === 'error' || scope.state === 'idle') {
          scope.state = 'offline';
          publish(scope);
        }
      },
      () => {
        isOnlineRef.current = true;
        const scope = activeScopeRef.current;
        if (Object.keys(scope.pending).length > 0) void performSaveRef.current?.(scope);
        else if (scope.state === 'offline') {
          scope.state = 'idle';
          publish(scope);
        }
      },
    );
    return unsub;
  }, [publish]);

  useEffect(() => {
    isMountedRef.current = true;
    const scopes = scopesRef.current;
    return () => {
      isMountedRef.current = false;
      for (const scope of scopes.values()) {
        clearDebounceTimer(scope);
        clearSavedTimer(scope);
      }
    };
  }, [clearDebounceTimer, clearSavedTimer]);

  return { state, error, hasPending, hasUnsaved, patch, flush, cancel, retry };
}
