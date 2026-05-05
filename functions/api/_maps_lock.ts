/**
 * _maps_lock.ts — Google Maps kill switch enforcement.
 *
 * Reads `app_settings.google_maps_locked` from D1 and throws MAPS_LOCKED (503)
 * when active. Wraps /api/poi-search, /api/route, /api/places/*, /api/geocode/*,
 * /api/trips/[id]/recompute-travel, etc.
 *
 * ## Cache strategy (autoplan T6 fix)
 *
 * D1 read 10s in-memory cache per CF Worker isolate（原 design 60s 改 10s 加快 unlock
 * 恢復）。同 isolate 11s 內重複 request 直接用 cache value。每 isolate cold start
 * 各自 cache，跨 isolate 無 invalidation broadcast — 接受 ≤10s stale-on-unlock 作為
 * trade-off vs 每 request 都打 D1 的成本。
 *
 * ## Lock semantics
 *
 * - locked=true → throw MAPS_LOCKED (503)；client 顯示「服務暫停，月初恢復」
 * - locked=false → noop
 * - app_settings 表不存在或 row 不存在 → fail-open（不鎖）；migration 0051 未 apply 時
 *   舊 code path 走 OSM 不會碰到此 helper
 *
 * ## Hysteresis (autoplan C4 — kept per user direction)
 *
 * 90% MTD lock / 50% MTD unlock — 由 daily-check `scripts/google-quota-monitor.ts`
 * 執行兩 transition；本 helper 只負責 enforce 當前 state。
 */
import { AppError } from './_errors';

interface LockState {
  locked: boolean;
  reason: string;
  fetched_at: number; // ms epoch — for 10s cache TTL
}

const CACHE_TTL_MS = 10_000; // autoplan T6 fix: 60s → 10s for fast unlock recovery
let cachedState: LockState | null = null;

/**
 * Read current lock state from D1 + cache 10s.
 *
 * Internal — exposed for test only。endpoints 用 `assertGoogleAvailable()`。
 */
export async function readLockState(db: D1Database): Promise<LockState> {
  const now = Date.now();
  if (cachedState && now - cachedState.fetched_at < CACHE_TTL_MS) {
    return cachedState;
  }

  try {
    const row = await db
      .prepare(
        `SELECT key, value FROM app_settings
         WHERE key IN ('google_maps_locked', 'google_maps_locked_reason')`,
      )
      .all<{ key: string; value: string }>();
    const map = new Map(row.results.map((r) => [r.key, r.value]));
    const next: LockState = {
      locked: map.get('google_maps_locked') === 'true',
      reason: map.get('google_maps_locked_reason') || '',
      fetched_at: now,
    };
    cachedState = next;
    return next;
  } catch {
    // Migration 0051 未 apply 或 D1 暫時 unavailable — fail-open（不鎖），讓 endpoint
    // 自行處理 D1 error。
    return { locked: false, reason: '', fetched_at: now };
  }
}

/**
 * Throw MAPS_LOCKED (503) if kill switch active. Endpoints call this BEFORE any
 * Google API request to avoid wasted upstream cost.
 */
export async function assertGoogleAvailable(db: D1Database): Promise<void> {
  const state = await readLockState(db);
  if (state.locked) {
    throw new AppError('MAPS_LOCKED', state.reason || undefined);
  }
}

/**
 * Force cache invalidation. Called by admin/maps-{lock,unlock}.ts after writing
 * the new state — ensures the calling isolate sees fresh state immediately
 * (other isolates wait ≤10s).
 */
export function invalidateLockCache(): void {
  cachedState = null;
}
