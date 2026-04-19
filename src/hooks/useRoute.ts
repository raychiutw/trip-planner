/**
 * useRoute — single-segment driving route via /api/route proxy
 *
 * - IndexedDB LRU cache (100 entries max), survives reloads
 * - Haversine straight-line fallback on network/API failure (with `approx: true` flag)
 * - Cache invalidation when POI `updated_at` is newer than cached timestamp
 *
 *   ┌── cache hit ──► return immediately
 *   │
 *   ├── cache miss ──► fetch /api/route?from=lng,lat&to=lng,lat
 *   │                     ├── success → store + return
 *   │                     └── error → Haversine fallback (approx)
 *   │
 *   └── invalidate if fromUpdatedAt/toUpdatedAt > cachedTs
 */

import { useEffect, useState } from 'react';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface RouteResult {
  /** [lat, lng] points for Leaflet polyline */
  polyline: [number, number][];
  /** seconds; null when unknown (approx fallback) */
  duration: number | null;
  /** meters */
  distance: number;
  /** true when Haversine fallback was used (no real road path) */
  approx?: boolean;
}

interface CacheEntry {
  key: string;
  polyline: [number, number][];
  duration: number | null;
  distance: number;
  approx: 0 | 1;
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

function haversineMeters(a: Coord, b: Coord): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
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
            approx: cached.approx === 1,
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
          approx?: boolean;
        };
        if (cancelled) return;
        // Backend may return 200 + approx:true for ferry-only / unreachable pairs —
        // preserve the flag through cache + setResult so UI can show "直線距離" hint.
        const isApprox = data.approx === true;
        const entry: CacheEntry = {
          key,
          polyline: data.polyline,
          duration: data.duration,
          distance: data.distance,
          approx: isApprox ? 1 : 0,
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
          approx: isApprox,
        });
      } catch {
        if (cancelled) return;
        const approx: RouteResult = {
          polyline: [
            [from.lat, from.lng],
            [to.lat, to.lng],
          ],
          duration: null,
          distance: haversineMeters(from, to),
          approx: true,
        };
        setResult(approx);
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
export const __internal = { cacheKey, haversineMeters };
