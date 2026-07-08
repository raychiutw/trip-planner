/**
 * tripViewState — 記住使用者最後檢視行程的「天」，供導航還原（v2.55.x）。
 *
 * 進 /trips 沒帶 ?selected 時，開回 activeTripId 並切到上次那一天（Q1「記住上次行程+位置」）。
 * 「哪個行程」的權威來源是 ActiveTripContext（activeTripId）；本模組只補記「位置＝天」，
 * 帶 tripId 標籤是為了讓 day 只在仍是同一個 active trip 時才套用（換行程後不套舊天）。
 * 展開中的景點還原走 URL `?focus=` 路徑（見 EditEntryPage goBack / TimelineRail）。
 *
 * 走 lsGet/lsSet（tp- 前綴 + 6 個月 TTL + 壞資料自清），不自己碰 localStorage。
 */
import { lsGet, lsSet } from './localStorage';

const KEY = 'last-trip-view';

export interface TripView {
  tripId: string;
  dayNum: number;
}

export function readTripView(): TripView | null {
  const v = lsGet<Partial<TripView>>(KEY);
  if (!v || typeof v.tripId !== 'string' || !v.tripId) return null;
  return { tripId: v.tripId, dayNum: typeof v.dayNum === 'number' ? v.dayNum : 0 };
}

export function writeTripView(view: TripView): void {
  lsSet(KEY, view);
}
