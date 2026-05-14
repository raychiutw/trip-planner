/**
 * TimelineEvent — type-only module（PR2 v2.7 之後）
 *
 * 之前是 4-col 「ocean-stop」 stop card component，但 Timeline.tsx 早已只 render
 * TimelineRail，TimelineEvent component 是 orphan。PR2 把 V3 inline expansion
 * 行為 port 到 TimelineRail（實際 render path），這裡只保留 5 個檔案還在用的
 * `TimelineEntryData` / `TravelData` 兩個 type。
 *
 * Type imports（不要破）：
 *   - components/trip/Timeline.tsx
 *   - components/trip/TimelineRail.tsx
 *   - components/trip/TodayRouteSheet.tsx
 *   - lib/timelineUtils.ts
 *   - lib/mapDay.ts
 */

import { type NavLocation } from './MapLinks';
import { type InfoBoxData } from './InfoBox';

export interface TravelData {
  type?: string | null;
  /** Free-form description (e.g.「沿縣道 58 號北上」). API surface as `desc`. */
  desc?: string | null;
  /** Travel duration in minutes. */
  min?: number | null;
  /** Driving distance in meters (Google Routes API). NULL for legacy entries. */
  distanceM?: number | null;
  /** Legacy alias kept for backwards compat — map source still emits `text`. */
  text?: string | null;
}

/**
 * v2.12 Wave 3：POI 照片 schema。`pois.photos` 是 JSON-encoded TEXT column，
 * mapDay.toTimelineEntry 會 parse 後 surface 為 PoiPhoto[]。
 *   - url：原圖 URL（Wikimedia Commons file URL 或 user upload）
 *   - thumbUrl：選填，縮圖（Commons API 可指定 iiurlwidth=400）
 *   - caption：選填，圖片說明
 *   - source / attribution：來源 + 授權說明（Wikimedia 圖片 ToS 要求 attribution）
 */
export interface PoiPhoto {
  url: string;
  thumbUrl?: string;
  caption?: string;
  source?: string;
  attribution?: string;
}

export interface StopPoiOptionData {
  poiId?: number | null;
  sortOrder?: number | null;
  name?: string | null;
  type?: string | null;
  category?: string | null;
  rating?: number | null;
  hours?: string | null;
  price?: string | null;
  reservation?: string | null;
  reservationUrl?: string | null;
  description?: string | null;
  note?: string | null;
  location?: NavLocation | null;
}

export interface TimelineEntryData {
  id?: number | null;
  /** v2.29.0: client-side composed display string (從 start_time/end_time 合成 by mapDay.ts).
   *  schema 已無 trip_entries.time col。frontend 仍接受此 field 作為 display fallback。 */
  time?: string | null;
  /** 抵達時間 "HH:MM"。schema source. */
  start_time?: string | null;
  /** 離開時間 "HH:MM"。schema source. */
  end_time?: string | null;
  /** Display title used by list/map UI. Keeps raw `title` intact for edit/export semantics. */
  displayTitle?: string | null;
  title?: string | null;
  description?: string | null;
  note?: string | null;
  googleRating?: number | null;
  source?: string | null;
  travel?: TravelData | string | null;
  locations?: NavLocation[] | null;
  infoBoxes?: InfoBoxData[] | null;
  /** Canonical entry POIs: first row (`sortOrder=1`) is the primary pick; remaining rows are alternates. */
  stopPois?: StopPoiOptionData[] | null;
  /** v2.12 Wave 3：POI photos （from pois.photos JSON column）。null = 還沒抓到，
   *  StopLightbox 顯示「即將推出」 placeholder。 */
  photos?: PoiPhoto[] | null;
  /** POI master type — surface 給 deriveTypeMeta 優先 over text-based keyword match。
   *  pois.type ∈ hotel|restaurant|shopping|parking|attraction|transport|activity|other */
  poiType?: string | null;
  /**
   * POI master coords — TimelineRail 用來算 Haversine(prev, curr) 與
   * `travel.distanceM` 比對，divergence > 20% 顯 ⚠「車程未更新」。
   * Master swap (v2.27.0) 後若沒重跑 recompute-travel，舊 distance/min 仍是 swap 前
   * 的 prev↔curr 路線、coord 已是新 master → 提示 user 重新計算。
   */
  masterLat?: number | null;
  masterLng?: number | null;
}
