/**
 * 行程讀取 hooks —— 讀 `/trips/:id`（meta）與 `/trips/:id/days`（天數索引）。
 *
 * 以前 5 個頁面各自抄「let cancelled = false → apiFetch → setState → catch 退成空值」：
 * meta 讀 5 份、days 讀 4 份。競態（換行程時舊回應晚到）、載入中不殘留上一個行程的資料、
 * 卸載後不更新狀態，現在只寫在這裡。
 *
 * 失敗不丟錯：status 'error'、data null。「失敗時退回什麼空值」是各頁的畫面決策
 * （目的地退回 []、行程名稱就省略…），由 caller 依 status 決定。
 * 寫入（新增天、平移日期…）不在這裡；那是 tripMutations 的事。
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';

export type TripReadStatus = 'idle' | 'loading' | 'ready' | 'error';
export type TripRead<T> = { data: T | null; status: TripReadStatus };

/** `/trips/:id` 回傳的常用欄位；各頁只讀自己需要的，其餘欄位保持 unknown。 */
export interface TripMeta {
  name?: string;
  title?: string;
  destinations?: Array<{ name?: string; lat?: number | null; lng?: number | null }>;
}

/** 結果綁定它是為哪個 path 抓的，換 path 的當下才不會把上一個行程的資料當成這一個的。 */
function useTripResource<T>(path: string | null, expectArray: boolean): TripRead<T> {
  const [result, setResult] = useState<{ path: string; data: T | null; ok: boolean } | null>(null);

  useEffect(() => {
    // 停用（enabled=false／沒有 tripId）時清掉舊結果：否則同一個 path 再啟用時會先吐出舊資料（換帳號時是上一位的）。
    if (!path) { setResult(null); return; }
    let cancelled = false;
    apiFetch<unknown>(path)
      .then((data) => {
        if (cancelled) return;
        if (expectArray && !Array.isArray(data)) throw new Error('Invalid response');
        setResult({ path, data: data as T, ok: true });
      })
      .catch(() => {
        if (!cancelled) setResult({ path, data: null, ok: false });
      });
    return () => { cancelled = true; };
  }, [path, expectArray]);

  if (!path) return { data: null, status: 'idle' };
  if (result?.path !== path) return { data: null, status: 'loading' };
  return result.ok ? { data: result.data, status: 'ready' } : { data: null, status: 'error' };
}

/** 讀 `/trips/:id`。tripId 為空或 enabled=false → 不發請求（status 'idle'）。 */
export function useTripMeta<T = TripMeta>(tripId: string | undefined, enabled = true): TripRead<T> {
  return useTripResource<T>(tripId && enabled ? `/trips/${encodeURIComponent(tripId)}` : null, false);
}

/** 讀 `/trips/:id/days`（`all: true` → 附整天 timeline）。回應不是陣列視為 error。 */
export function useTripDays<T = { id: number; dayNum: number }>(
  tripId: string | undefined,
  opts: { all?: boolean; enabled?: boolean } = {},
): TripRead<T[]> {
  const path = tripId && opts.enabled !== false
    ? `/trips/${encodeURIComponent(tripId)}/days${opts.all ? '?all=1' : ''}`
    : null;
  return useTripResource<T[]>(path, true);
}

/** 穩定的空陣列：每次 render 新建 [] 會讓依賴它的 useMemo 每次失效。凍結，避免某個 caller 就地 sort／push 後汙染所有頁面。 */
export const NO_DESTINATIONS: never[] = Object.freeze([]) as unknown as never[];

/**
 * 行程目的地，給「地圖預設中心」的 fallback chain 用。
 * 載入中回 null（區分「未載入」與「載入後 0 個」—— LocationPickerMap 只吃 mount 當下的 initialCenter，
 * 用 Tokyo 預設 mount 後就被鎖死）；讀取失敗回 []（fallback chain 走 Tokyo，至少能 mount）。
 */
export function useTripDestinations<D = NonNullable<TripMeta['destinations']>[number]>(
  tripId: string | undefined,
  enabled = true,
): D[] | null {
  const read = useTripMeta<{ destinations?: D[] }>(tripId, enabled);
  if (read.status === 'ready') return read.data?.destinations ?? NO_DESTINATIONS;
  return read.status === 'error' ? NO_DESTINATIONS : null;
}
