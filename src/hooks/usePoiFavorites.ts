import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import type { PoiFavorite } from '../types/api';

/** A favorites read belongs to the active picker visit and retry attempt. */
export function usePoiFavorites(enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const scope = useMemo(() => ({enabled, attempt}), [enabled, attempt]);
  const [snapshot, setSnapshot] = useState<{scope: object; rows: PoiFavorite[] | null; error: string | null} | null>(null);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    apiFetch<PoiFavorite[]>('/poi-favorites').then(rows => {
      if (!Array.isArray(rows)) throw new Error('Invalid favorites response');
      if (!cancelled) setSnapshot({scope, rows, error: null});
    }).catch(() => {
      if (!cancelled) setSnapshot({scope, rows: null, error: '收藏載入失敗，請重試'});
    });
    return () => { cancelled = true; };
  }, [enabled, scope]);
  const current = enabled && snapshot?.scope === scope ? snapshot : null;
  return {
    favorites: current?.rows ?? null,
    status: !enabled ? 'idle' : !current ? 'loading' : current.error ? 'error' : 'success',
    error: current?.error ?? null,
    retry,
  };
}
