/**
 * timeline.ts — shared timeline data shapes（v2.33.37 round 2 architecture refactor）
 *
 * 之前這些 interface 散在 `src/components/trip/*.tsx` 內，但 `src/lib/mapDay.ts`
 * 與 `src/lib/timelineUtils.ts` 需要它們做純資料 transform。lib → components
 * import 是反向依賴（util layer 應為 leaf），會綁定不必要的 React render tree。
 *
 * 集中到 `src/types/` 後：
 *  - lib 從這裡取，components 也從這裡取（或繼續經 component re-export 過渡）
 *  - 沒有 React import，純 type 模組
 */

/** Location data shape used by map link generation. */
export interface MapLocation {
  name?: string;
  googleQuery?: string;
  appleQuery?: string;
  naverQuery?: string;
  /** Legacy field – falls back for google link */
  url?: string;
  label?: string;
}

/** Location with a display label (for `NavLinks` rendering). */
export interface NavLocation extends MapLocation {}

/** Travel segment between two stops. */
export interface TravelData {
  type?: string | null;
  /** transit 細分方式（monorail/bus/metro/…或「其他」自由文字）；非 transit → null。 */
  submode?: string | null;
  /** Free-form description (e.g.「沿縣道 58 號北上」). API surface as `desc`. */
  desc?: string | null;
  /** Travel duration in minutes. */
  min?: number | null;
  /** Driving distance in meters (Google Routes API). NULL for legacy entries. */
  distanceM?: number | null;
  /** v2.55.46: true = 同一地點/免交通 → 收合成「同一地點」marker（唯讀/列印面用）。 */
  sameplace?: boolean;
  /** Legacy alias kept for backwards compat — map source still emits `text`. */
  text?: string | null;
}

/** Master / alternate POI option attached to a timeline entry (`trip_entry_pois` row). */
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

/** Single timeline entry (one stop on a trip day). */
export interface TimelineEntryData {
  id?: number | null;
  /** v2.29.0: client-side composed display string (從 startTime/endTime 合成 by mapDay.ts).
   *  schema 已無 trip_entries.time col。frontend 仍接受此 field 作為 display fallback。 */
  time?: string | null;
  /** 抵達時間 "HH:MM"。schema source。v2.31.77 改 camelCase（backend deepCamel'd response）。 */
  startTime?: string | null;
  /** 離開時間 "HH:MM"。schema source。 */
  endTime?: string | null;
  /** Display label used by list/map UI. Derived from the primary POI name only. */
  displayTitle?: string | null;
  /** Legacy raw entry title. Do not use for display. */
  title?: string | null;
  description?: string | null;
  note?: string | null;
  googleRating?: number | null;
  source?: string | null;
  travel?: TravelData | string | null;
  locations?: NavLocation[] | null;
  /** Canonical entry POIs: first row (`sortOrder=1`) is the primary pick; remaining rows are alternates. */
  stopPois?: StopPoiOptionData[] | null;
  /** POI master type — surface 給 deriveTypeMeta 優先 over text-based keyword match。
   *  pois.type ∈ hotel|restaurant|shopping|parking|attraction|transport|activity|other */
  poiType?: string | null;
  /**
   * POI master coords — TimelineRail self-healing 用來判斷哪些相鄰 pair 可
   * 自動補算車程（兩端都有座標才觸發 requestTravelRecompute）。
   */
  masterLat?: number | null;
  masterLng?: number | null;
}
