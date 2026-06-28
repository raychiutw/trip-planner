/**
 * segments/_shared.ts — segment travel 計算共用邏輯（PATCH /:sid 與 POST 共用）。
 *
 * 抽出「依 mode 算 min / distance / source / computed_at」的邏輯，讓「改既有 segment」
 * （PATCH /:sid）與「建立 segment」（POST）兩條路徑共用，避免 Google Routes 呼叫重複。
 *
 * 語意對齊 v2.30.0：
 *   - transit → user 手填 min，source='manual'，不打 Google API。
 *   - driving / walking → 一律打 Google Routes 從 from/to entry 的 master POI 座標重算，
 *     ignore 任何傳入 min。source='google'。失敗 / 缺 coords / 缺 API key → ok:false，
 *     caller 自行決定（PATCH 保留舊值標 stale；POST 新建為 null）。
 */
import { computeRoute } from '../../../../../src/server/maps/google-client';
import { assertGoogleAvailable } from '../../../_maps_lock';
import type { Env } from '../../../_types';

export const VALID_SEGMENT_MODES = ['driving', 'walking', 'transit'] as const;
export type SegmentMode = (typeof VALID_SEGMENT_MODES)[number];
export const MAX_SEGMENT_MIN = 1440;

export function isSegmentMode(v: unknown): v is SegmentMode {
  return typeof v === 'string' && (VALID_SEGMENT_MODES as readonly string[]).includes(v);
}

export type SegmentTravelResult =
  | { ok: true; min: number; distanceM: number | null; source: 'google' | 'manual'; computedAt: number }
  | { ok: false };

/** 取某 entry 的 master POI（sort_order=1）座標；缺 POI 或缺座標 → null。 */
async function entryMasterCoords(
  db: D1Database,
  entryId: number,
): Promise<{ lat: number; lng: number } | null> {
  const row = await db
    .prepare(
      `SELECT p.lat AS lat, p.lng AS lng
       FROM trip_entry_pois tep
       JOIN pois p ON p.id = tep.poi_id
       WHERE tep.entry_id = ? AND tep.sort_order = 1`,
    )
    .bind(entryId)
    .first<{ lat: number | null; lng: number | null }>();
  if (!row || row.lat == null || row.lng == null) return null;
  return { lat: row.lat, lng: row.lng };
}

/**
 * 算 from→to 的 travel fields（不寫 DB）。
 * transit 一律成功（手填）；driving / walking 缺 coords / API key / Routes 失敗 → ok:false。
 */
export async function resolveSegmentTravel(
  env: Env,
  db: D1Database,
  fromEntryId: number,
  toEntryId: number,
  mode: SegmentMode,
  manualMin: number | undefined,
  now: number,
): Promise<SegmentTravelResult> {
  if (mode === 'transit') {
    // defensive：caller 應已驗 manualMin 範圍，但不靠 `as number` 假設 — 無效則 ok:false
    // （避免未來新 caller 跳驗證把 NaN 寫進 min）。distance_m 對 transit 無距離語意 → null。
    if (typeof manualMin !== 'number' || !Number.isFinite(manualMin) || manualMin < 1 || manualMin > MAX_SEGMENT_MIN) {
      return { ok: false };
    }
    return { ok: true, min: Math.round(manualMin), distanceM: null, source: 'manual', computedAt: now };
  }

  // driving / walking — Google Routes 重算
  const [from, to] = await Promise.all([
    entryMasterCoords(db, fromEntryId),
    entryMasterCoords(db, toEntryId),
  ]);
  if (!from || !to || !env.GOOGLE_MAPS_API_KEY) return { ok: false };

  try {
    // MAPS_LOCKED kill-switch parity（對齊 recompute-travel）：quota lock 時不燒 Google
    // Routes，throw 被下方 catch → ok:false（segment 建成 stale，不阻擋 user 切 mode）。
    await assertGoogleAvailable(db);
    const apiMode: 'WALK' | 'DRIVE' = mode === 'walking' ? 'WALK' : 'DRIVE';
    const result = await computeRoute(env.GOOGLE_MAPS_API_KEY, from, to, apiMode);
    return {
      ok: true,
      min: Math.round(result.duration_seconds / 60),
      distanceM: result.distance_meters,
      source: 'google',
      computedAt: now,
    };
  } catch {
    return { ok: false };
  }
}
