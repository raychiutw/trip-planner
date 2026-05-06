/**
 * useRoute — single-segment driving route via /api/route proxy
 *
 * - IndexedDB LRU cache (100 entries max), survives reloads
 * - On /api/route failure (502 MAPS_UPSTREAM_FAILED / 503 MAPS_LOCKED) → returns null.
 *   No frontend Haversine fallback per v2.23.0 P11/T13. UI must handle null (e.g. hide
 *   polyline + show fallback row meta).
 * - Cache invalidation when POI `updated_at` is newer than cached timestamp
 *
 *   ┌── cache hit ──► return immediately
 *   │
 *   ├── cache miss ──► fetch /api/route?from=lng,lat&to=lng,lat
 *   │                     ├── success → store + return
 *   │                     └── error → setResult(null)
 *   │
 *   └── invalidate if fromUpdatedAt/toUpdatedAt > cachedTs
 */

import { useEffect, useState } from 'react';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface RouteResult {
  /** [lat, lng] points for polyline */
  polyline: [number, number][];
  /** seconds */
  duration: number | null;
  /** meters */
  distance: number;
}

interface CacheEntry {
  key: string;
  polyline: [number, number][];
  duration: number | null;
  distance: number;
  ts: number;
}

interface RouteCacheSchema extends DBSchema {
  routes: {
    key: string;
    value: CacheEntry;
    indexes: { 'by-ts': number };
  };
}

const DB_NAME = 'trip-planner-routes';
const DB_VERSION = 1;
const STORE = 'routes';
const LRU_MAX = 100;

let dbPromise: Promise<IDBPDatabase<RouteCacheSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<RouteCacheSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<RouteCacheSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('by-ts', 'ts');
      },
    });
  }
  return dbPromise;
}

function cacheKey(from: Coord, to: Coord): string {
  const round = (n: number) => n.toFixed(5);
  return `v1:${round(from.lat)},${round(from.lng)}->${round(to.lat)},${round(to.lng)}`;
}

async function writeWithLru(entry: CacheEntry): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readwrite');
  await tx.store.put(entry);
  const count = await tx.store.count();
  if (count > LRU_MAX) {
    const oldest = await tx.store.index('by-ts').openCursor();
    const toEvict = count - LRU_MAX;
    let evicted = 0;
    let cursor = oldest;
    while (cursor && evicted < toEvict) {
      await cursor.delete();
      evicted++;
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}

export interface Coord {
  lat: number;
  lng: number;
}

export interface UseRouteOptions {
  /** If provided, cache is invalidated when either timestamp exceeds the cached entry's ts */
  fromUpdatedAt?: number;
  toUpdatedAt?: number;
  /** Disable fetching; return null until enabled (e.g., map collapsed) */
  enabled?: boolean;
}

export function useRoute(
  from: Coord | null,
  to: Coord | null,
  opts: UseRouteOptions = {},
): RouteResult | null {
  const { fromUpdatedAt, toUpdatedAt, enabled = true } = opts;
  const [result, setResult] = useState<RouteResult | null>(null);

  useEffect(() => {
    if (!enabled || !from || !to) {
      setResult(null);
      return;
    }
    let cancelled = false;
    const key = cacheKey(from, to);
    const latestStamp = Math.max(fromUpdatedAt ?? 0, toUpdatedAt ?? 0);

    (async () => {
      try {
        const db = await getDb();
        const cached = await db.get(STORE, key);
        if (cached && cached.ts >= latestStamp) {
          if (cancelled) return;
          setResult({
            polyline: cached.polyline,
            duration: cached.duration,
            distance: cached.distance,
          });
          return;
        }
      } catch {
        // IndexedDB may fail in private mode — silently skip cache
      }

      try {
        const res = await fetch(
          `/api/route?from=${from.lng},${from.lat}&to=${to.lng},${to.lat}`,
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as {
          polyline: [number, number][];
          duration: number | null;
          distance: number;
        };
        if (cancelled) return;
        const entry: CacheEntry = {
          key,
          polyline: data.polyline,
          duration: data.duration,
          distance: data.distance,
          ts: Date.now(),
        };
        try {
          await writeWithLru(entry);
        } catch {
          // quota exceeded or private mode — silent skip
        }
        setResult({
          polyline: data.polyline,
          duration: data.duration,
          distance: data.distance,
        });
      } catch {
        if (cancelled) return;
        // v2.23.0 P11/T13: no Haversine fallback. Backend 502/503 → null;
        // UI handles missing polyline (skip render or show error meta).
        setResult(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    from?.lat,
    from?.lng,
    to?.lat,
    to?.lng,
    fromUpdatedAt,
    toUpdatedAt,
    enabled,
  ]);

  return result;
}

/** Exposed for testing only. */
export const __internal = { cacheKey };
