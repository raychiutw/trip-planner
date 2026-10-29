import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import type { PoiFavorite } from '../types/api';

export type PoiFavoriteRow = Pick<PoiFavorite, 'id' | 'poiId' | 'poiAddress' | 'poiLat' | 'poiLng' | 'poiType' | 'poiRating'> & { poiName: string };

export function normalizePoiFavorites(data: unknown): PoiFavoriteRow[] {
  if (!Array.isArray(data)) throw new Error('Invalid favorites response');
  const rows: PoiFavoriteRow[] = data.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const id = Number(item.id);
    const poiId = Number(item.poiId);
    const poiName = item.poiName;
    if (!Number.isFinite(id) || !Number.isFinite(poiId) || typeof poiName !== 'string' || !poiName.trim()) return [];
    return [{
      id,
      poiId,
      poiName,
      poiAddress: typeof item.poiAddress === 'string' ? item.poiAddress : null,
      poiLat: typeof item.poiLat === 'number' ? item.poiLat : null,
      poiLng: typeof item.poiLng === 'number' ? item.poiLng : null,
      poiType: typeof item.poiType === 'string' ? item.poiType : 'poi',
      poiRating: typeof item.poiRating === 'number' ? item.poiRating : null,
    }];
  });
  if (data.length > 0 && rows.length === 0) throw new Error('Invalid favorites response');
  return rows;
}

type FavoriteState =
  | { status: 'loading'; rows: PoiFavoriteRow[] }
  | { status: 'ready'; rows: PoiFavoriteRow[] }
  | { status: 'error'; rows: PoiFavoriteRow[] };

export function usePoiFavorites(enabled: boolean): { state: FavoriteState; retry: () => void } {
  const [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<{ generation: number; state: FavoriteState } | null>(null);
  const retry = useCallback(() => setGeneration((value) => value + 1), []);

  useEffect(() => {
    if (!enabled || result?.generation === generation) return;
    let cancelled = false;
    apiFetch<unknown>('/poi-favorites')
      .then((data) => {
        if (!cancelled) setResult({ generation, state: { status: 'ready', rows: normalizePoiFavorites(data) } });
      })
      .catch(() => {
        if (!cancelled) setResult({ generation, state: { status: 'error', rows: [] } });
      });
    return () => { cancelled = true; };
  }, [enabled, generation, result?.generation]);

  return {
    state: result?.generation === generation ? result.state : { status: 'loading', rows: [] },
    retry,
  };
}
