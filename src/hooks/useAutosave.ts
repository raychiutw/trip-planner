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
 *   - save success → bump version; later edits remain queued; saved feedback only when drained
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

export type SaveResult = { status: 'saved' } | { status: 'error'; error: string } | { status: 'offline' } | { status: 'superseded' };

export interface UseAutosaveOptions<T> {
  /** Stable identity of the edited entity; changing it starts an isolated lifetime. */
  entityKey?: string;
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
  /** Drain accepted edits; report saved only after all batches succeed. */
  flush: () => Promise<SaveResult>;
  /** Discard pending updates (clear timer + drop merged patch). */
  cancel: () => void;
  /** 手動 retry — 失敗後 user click「重試」 button。 */
  retry: () => Promise<SaveResult>;
}

interface SaveScope<T> {
  key: string | undefined;
  version: number | undefined;
  pending: Partial<T>;
  flight: Promise<SaveResult> | null;
  timer: ReturnType<typeof setTimeout> | null;
  savedTimer: ReturnType<typeof setTimeout> | null;
  active: boolean;
  state: SaveState;
  error: string | null;
}

function createScope<T>(key: string | undefined, version: number | undefined): SaveScope<T> {
  return { key, version, pending: {}, flight: null, timer: null, savedTimer: null,
    active: true, state: 'idle', error: null };
}

function clearTimer<T>(scope: SaveScope<T>, key: 'timer' | 'savedTimer') {
  if (scope[key] !== null) clearTimeout(scope[key]);
  scope[key] = null;
}

export function useAutosave<T extends object>(options: UseAutosaveOptions<T>): UseAutosaveReturn<T> {
  const { entityKey, initialVersion, debounceMs = 800, savedDisplayMs = 2000, save, onStale } = options;
  // A scope owns its queue, batch, version and feedback. New entities never share them.
  const [scope, setScope] = useState(() => createScope<T>(entityKey, initialVersion));
  if (scope.key !== entityKey) setScope(createScope<T>(entityKey, initialVersion));
  const [, render] = useState(0);
  const online = useRef(true);
  const publish = useCallback((state: SaveState, error: string | null = null) => {
    if (!scope.active) return;
    scope.state = state;
    scope.error = error;
    render(n => n + 1);
  }, [scope]);

  const performSave = useCallback((): Promise<SaveResult> => {
    if (!scope.active) return Promise.resolve({ status: 'superseded' });
    if (scope.flight) return scope.flight;
    if (!Object.keys(scope.pending).length) return Promise.resolve({ status: 'saved' });
    if (!online.current) {
      publish('offline');
      return Promise.resolve({ status: 'offline' });
    }
    const batch = scope.pending;
    scope.pending = {};
    clearTimer(scope, 'savedTimer');
    publish('saving');
    // Defer execution until the shared promise has been installed, even for sync throws.
    const task = Promise.resolve().then(async (): Promise<SaveResult> => {
      try {
        let result: Record<string, unknown>;
        try {
          result = await save(batch, scope.version);
        } catch (error) {
          if (!scope.active) return { status: 'superseded' };
          if (!(error instanceof ApiError) || error.code !== 'STALE_ENTRY' || !onStale) throw error;
          const version = await onStale();
          if (!scope.active) return { status: 'superseded' };
          scope.version = version;
          // The retry consumes only this batch, never edits accepted while it waits.
          result = await save(batch, scope.version);
        }
        if (!scope.active) return { status: 'superseded' };
        if (typeof result.version === 'number') scope.version = result.version;
        publish(Object.keys(scope.pending).length ? 'pending' : 'saved');
        if (scope.state === 'saved') scope.savedTimer = setTimeout(() => {
          scope.savedTimer = null;
          if (scope.state === 'saved') publish('idle');
        }, savedDisplayMs);
        return { status: 'saved' };
      } catch (error) {
        if (!scope.active) return { status: 'superseded' };
        scope.pending = { ...batch, ...scope.pending };
        clearTimer(scope, 'timer');
        const message = error instanceof Error ? error.message : '儲存失敗';
        publish('error', message);
        return { status: 'error', error: message };
      } finally {
        scope.flight = null;
      }
    });
    scope.flight = task;
    return task;
  }, [scope, publish, save, onStale, savedDisplayMs]);

  const saveLatest = useRef(performSave);
  saveLatest.current = performSave;
  const schedule = useCallback(() => {
    clearTimer(scope, 'timer');
    scope.timer = setTimeout(async () => {
      scope.timer = null;
      if (!scope.active) return;
      const outcome = await saveLatest.current();
      if (scope.active && outcome.status === 'saved' && Object.keys(scope.pending).length && scope.timer === null) schedule();
    }, debounceMs);
  }, [scope, debounceMs]);

  const patch = useCallback((updates: Partial<T>) => {
    if (!scope.active || !Object.keys(updates).length) return;
    scope.pending = { ...scope.pending, ...updates };
    clearTimer(scope, 'savedTimer');
    publish(scope.flight ? 'saving' : online.current ? 'pending' : 'offline');
    schedule();
  }, [scope, publish, schedule]);

  const flush = useCallback(async (): Promise<SaveResult> => {
    do {
      if (!scope.active) return { status: 'superseded' };
      clearTimer(scope, 'timer');
      const outcome = await performSave();
      if (outcome.status !== 'saved') return outcome;
    } while (scope.flight || Object.keys(scope.pending).length);
    clearTimer(scope, 'timer');
    return { status: 'saved' };
  }, [scope, performSave]);

  const cancel = useCallback(() => {
    if (!scope.active) return;
    clearTimer(scope, 'timer');
    clearTimer(scope, 'savedTimer');
    scope.pending = {};
    publish(scope.flight ? 'saving' : 'idle');
  }, [scope, publish]);

  useEffect(() => registerNetworkCallbacks(
    () => { online.current = false; if (!scope.flight) publish('offline'); },
    () => {
      online.current = true;
      if (Object.keys(scope.pending).length) void flush();
      else if (scope.state === 'offline') publish('idle');
    },
  ), [scope, publish, flush]);

  useEffect(() => {
    scope.active = true; // React StrictMode repeats setup after cleanup.
    return () => {
      scope.active = false;
      clearTimer(scope, 'timer');
      clearTimer(scope, 'savedTimer');
    };
  }, [scope]);

  return { state: scope.state, error: scope.error,
    hasPending: !!scope.flight || Object.keys(scope.pending).length > 0,
    patch, flush, cancel, retry: flush };
}
