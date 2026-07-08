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
 *   toast UX。失敗 reject。
 * - **auto**（`{ auto: true, signature }`，TimelineRail self-healing 用）：
 *   以 **gap signature**（缺口 pair 清單的指紋）防重 — 同一個缺口每個 scope
 *   只自動嘗試一次；缺口內容改變（真的有新 mutation 改了 adjacency）→
 *   signature 不同 → 天然 re-arm。unhealable gap（缺座標 pair、持續 API 錯）
 *   signature 永遠相同 → 永不重打，不受無關 mutation（改 note 等）影響
 *   （codex review P1 / perf CRIT-2）。失敗 resolve null 不 reject、不 toast；
 *   收到 403（唯讀 viewer）→ 該 trip 的 auto 整個停用（codex review P2）。
 *   恢復路徑（v2.55.x TravelPill 手動鈕移除後）：page reload 清 module-level
 *   狀態、或真實 mutation 改變 gap signature → auto 天然 re-arm；缺座標 pair
 *   需 user 補座標後 gap 才成立（TravelPill 顯「缺座標」提示）。唯讀 viewer
 *   本就不可寫，無恢復路徑（改顯中性 chip、不再紅字警示）。
 *
 * ## Scope key
 *
 * `${tripId}|${dayNum ?? 'all'}`。all-scope in-flight 涵蓋該 trip 所有 day
 * scope（auto 判斷時一併檢查），避免 day 級 auto 跟全 trip explicit 重複燒
 * Google quota。auto 因 in-flight 被跳過時同樣記 signature — 該 in-flight
 * 請求就是本次缺口的嘗試（perf review：防 refetch race 的一次性 duplicate）。
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
/** auto 已嘗試的 gap signature（scopeKey → signature）。 */
const autoAttemptedSig = new Map<string, string>();
/** auto 收過 403 的 trip（唯讀 viewer）— 後續 auto 全 skip，不再浪費請求。 */
const autoNoWriteTrips = new Set<string>();

function scopeKey(tripId: string, dayNum: number | null): string {
  return `${tripId}|${dayNum ?? 'all'}`;
}

/**
 * day scope normalize — 唯一 choke point。route param（string）與 state
 * （number）都收；無效/缺/非正整數 → null = 全 trip scope（後端 day 驗證
 * 要求 ≥1，送 ?day=0 只會 400）。
 */
function normalizeDayNum(dayNum: number | string | null | undefined): number | null {
  if (dayNum == null || dayNum === '') return null;
  const n = Number(dayNum);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** @internal 測試用 — 清空 module state。 */
export function __resetTravelRecomputeState(): void {
  inflight.clear();
  autoAttemptedSig.clear();
  autoNoWriteTrips.clear();
}

/**
 * 觸發 recompute-travel。回傳 backend 統計；auto 模式被 guard 擋下時回 null。
 * explicit 模式失敗會 reject（caller 自行 toast）；auto 模式失敗不 reject
 * （回 null）。
 */
export function requestTravelRecompute(
  tripId: string,
  dayNum?: number | string | null,
  opts?: { auto?: boolean; signature?: string },
): Promise<RecomputeTravelResult | null> {
  const day = normalizeDayNum(dayNum);
  const key = scopeKey(tripId, day);
  const auto = opts?.auto === true;

  if (auto) {
    const signature = opts?.signature ?? '';
    if (autoNoWriteTrips.has(tripId)) return Promise.resolve(null);
    if (autoAttemptedSig.get(key) === signature) return Promise.resolve(null);
    // in-flight（同 key 或 all-scope）即本缺口的嘗試 — 記 signature 後跳過
    if (inflight.has(key) || inflight.has(scopeKey(tripId, null))) {
      autoAttemptedSig.set(key, signature);
      return Promise.resolve(null);
    }
    autoAttemptedSig.set(key, signature);
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const query = day != null ? `?day=${day}` : '';
  const p = (async (): Promise<RecomputeTravelResult> => {
    const res = await apiFetchRaw(
      `/trips/${encodeURIComponent(tripId)}/recompute-travel${query}`,
      { method: 'POST', credentials: 'same-origin' },
    );
    if (!res.ok) {
      throw Object.assign(new Error(`recompute-travel ${res.status}`), { status: res.status });
    }
    const data = await res.json().catch(() => ({})) as RecomputeTravelResult;
    window.dispatchEvent(new CustomEvent(EVENT.segmentUpdated, { detail: { tripId } }));
    return data;
  })();

  inflight.set(key, p);
  const cleanup = () => { inflight.delete(key); };

  if (auto) {
    // auto 失敗靜默（唯讀 403 / MAPS_LOCKED / 網路錯都不該吵 user）
    return p.then(
      (data) => { cleanup(); return data; },
      (err) => {
        cleanup();
        if ((err as { status?: number } | null)?.status === 403) {
          autoNoWriteTrips.add(tripId);
        }
        // 監控可見性：auto 靜默但至少留 console 痕跡（signature 防重保證
        // 同 gap 只 log 一次，不會 spam）。systemic 壞掉（key rotation、
        // routes regression）才有跡可循。
        console.warn('[travelRecompute] auto recompute failed:', (err as Error)?.message ?? err);
        return null;
      },
    );
  }
  return p.finally(cleanup);
}
