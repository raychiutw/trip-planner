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

export interface TravelData { type?: string | null; text?: string | null; }

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

export interface TimelineEntryData {
  id?: number | null;
  time?: string | null;
  title?: string | null;
  description?: string | null;
  note?: string | null;
  googleRating?: number | null;
  source?: string | null;
  travel?: TravelData | string | null;
  locations?: NavLocation[] | null;
  infoBoxes?: InfoBoxData[] | null;
  /** v2.12 Wave 3：POI photos （from pois.photos JSON column）。null = 還沒抓到，
   *  StopLightbox 顯示「即將推出」 placeholder。 */
  photos?: PoiPhoto[] | null;
}
