/**
 * travelRecompute — POST /recompute-travel 的共用 single-flight 入口
 *
 * ## 為何存在（2026-07-06 車程重算缺口重盤）
 *
 * 車程 invalidation 原本散彈式分佈在各頁面「自己記得打」recompute-travel：
 * 新增（AddStopPage / AddCustomStopPage / AddPoiFavoriteToTripPage）、換 POI
 * （ChangePoiPage）、拖曳排序（TimelineRail）有打；**刪除（TimelineRail /
 * EditEntryPage）、搬日/複製（EntryActionPage）、後端直寫（AI chat / import /
 * share clone / tp-* CLI）全漏**。所有觸發點（含 TimelineRail self-healing
 * 自動補算）改走本 helper，dedup 才成立。
 *
 * ## 兩種模式
 *
 * - **explicit**（預設）：mutation 後顯式觸發。同 scope 併發 → 共用同一
 *   in-flight promise（single-flight），caller 各自掛 .then/.catch 做自己的
 *   toast UX。
 * - **auto**（`{ auto: true }`，TimelineRail self-healing 用）：每個 scope 在
 *   一次 mutation（EVENT.entryUpdated）之後最多自動嘗試一次。失敗（唯讀 403、
 *   MAPS_LOCKED、網路錯）→ 標記 attempted 靜默停，不 loop、不 toast；下次
 *   mutation 才再試。缺座標 pair 由 backend 跳過（不寫 row）→ 同樣被 attempted
 *   擋住，fallback 是既有 TravelPill ⚠ 手動鈕。
 *
 * ## Scope key
 *
 * `${tripId}|${dayNum ?? 'all'}`。all-scope in-flight 涵蓋該 trip 所有 day
 * scope（auto 判斷時一併檢查），避免 day 級 auto 跟全 trip explicit 重複燒
 * Google quota。
 */
import { apiFetchRaw } from './apiClient';
import { EVENT } from './events';

export interface RecomputeTravelResult {
  pairsComputed?: number;
  pairsSkippedTransit?: number;
  pairsSkippedMissingCoords?: number;
  errorsDetail?: Array<{ entryId: number; message: string }>;
}

const inflight = new Map<string, Promise<RecomputeTravelResult>>();
const autoAttempted = new Set<string>();
let listenerRegistered = false;

function scopeKey(tripId: string, dayNum?: number | null): string {
  return `${tripId}|${dayNum ?? 'all'}`;
}

/** entryUpdated = 行程有新 mutation → 該 trip 的 auto 嘗試權重置。 */
function ensureResetListener(): void {
  if (listenerRegistered || typeof window === 'undefined') return;
  listenerRegistered = true;
  window.addEventListener(EVENT.entryUpdated, (e: Event) => {
    const detail = (e as CustomEvent).detail as { tripId?: string } | null;
    const tripId = detail?.tripId;
    for (const key of autoAttempted) {
      if (!tripId || key.startsWith(`${tripId}|`)) autoAttempted.delete(key);
    }
  });
}

/** @internal 測試用 — 清空 module state。 */
export function __resetTravelRecomputeState(): void {
  inflight.clear();
  autoAttempted.clear();
}

/**
 * 觸發 recompute-travel。回傳 backend 統計；auto 模式被 guard 擋下時回 null。
 * explicit 模式失敗會 reject（caller 自行 toast）；auto 模式失敗不 reject
 * （回 null），只標記 attempted。
 */
export function requestTravelRecompute(
  tripId: string,
  dayNum?: number | null,
  opts?: { auto?: boolean },
): Promise<RecomputeTravelResult | null> {
  ensureResetListener();
  const key = scopeKey(tripId, dayNum);
  const auto = opts?.auto === true;

  if (auto) {
    if (autoAttempted.has(key)) return Promise.resolve(null);
    // all-scope in-flight 已涵蓋本 day → 不重打
    if (inflight.has(key) || inflight.has(scopeKey(tripId, null))) {
      return Promise.resolve(null);
    }
    autoAttempted.add(key);
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const query = typeof dayNum === 'number' ? `?day=${dayNum}` : '';
  const p = (async (): Promise<RecomputeTravelResult> => {
    const res = await apiFetchRaw(
      `/trips/${encodeURIComponent(tripId)}/recompute-travel${query}`,
      { method: 'POST', credentials: 'same-origin' },
    );
    if (!res.ok) throw new Error(`recompute-travel ${res.status}`);
    const data = await res.json().catch(() => ({})) as RecomputeTravelResult;
    window.dispatchEvent(new CustomEvent(EVENT.segmentUpdated, { detail: { tripId } }));
    return data;
  })();

  inflight.set(key, p);
  const cleanup = () => { inflight.delete(key); };

  if (auto) {
    // auto 失敗靜默（403 唯讀 / MAPS_LOCKED / 網路錯都不該吵 user）
    return p.then(
      (data) => { cleanup(); return data; },
      () => { cleanup(); return null; },
    );
  }
  return p.finally(cleanup);
}
