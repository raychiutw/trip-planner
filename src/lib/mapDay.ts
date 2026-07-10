/**
 * Maps raw API day response data to component-expected shapes.
 * POI Schema: API returns canonical trip_entry_pois rows for timeline entries.
 */

// v2.33.37 round 2: types extracted to src/types/timeline.ts (was inverted dep
// on src/components/trip/*; lib should be leaf module).
import type {
  TimelineEntryData,
  TravelData,
  PoiPhoto,
  StopPoiOptionData,
  NavLocation,
} from '../types/timeline';
import type { Day, Entry } from '../types/trip';
import { getStopDisplayTitle } from './stopDisplay';

/* ===== Entry lookup helpers (shared across pages/components) ===== */

export interface DayEntryContext {
  entry: Entry;
  dayNum: number;
  date: string | null;
  label: string | null;
}

/** Linear scan all days for a matching entry id. Returns null if not found or id invalid. */
export function findEntryInDays(
  allDays: Record<number, Day>,
  entryId: number,
): DayEntryContext | null {
  if (!Number.isFinite(entryId)) return null;
  for (const dayNum of Object.keys(allDays).map((n) => Number(n))) {
    const day = allDays[dayNum];
    if (!day?.timeline) continue;
    const entry = day.timeline.find((e) => e.id === entryId);
    if (entry) return { entry, dayNum, date: day.date ?? null, label: day.label ?? null };
  }
  return null;
}

/** Parse a YYYY-MM-DD string as a local-time Date. Returns null on invalid/empty.
 *  Rejects rollovers like '2026-02-30' (JS would silently interpret as Mar 2). */
export function parseLocalDate(date: string | null | undefined): Date | null {
  if (!date) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) return null;
  return d;
}

/** Format a YYYY-MM-DD date string as "M/D" in local time. Empty string on invalid. */
export function formatDateLabel(date: string | null | undefined): string {
  const d = parseLocalDate(date);
  return d ? `${d.getMonth() + 1}/${d.getDate()}` : '';
}

/* ===== Raw input interfaces (camelCase, matching API response from mergePoi) ===== */

/** Raw travel object nested in a timeline entry. */
interface RawTravel {
  type?: string | null;
  submode?: string | null;
  sameplace?: boolean;
  desc?: string | null;
  min?: number | null;
  distanceM?: number | null;
}

/** Raw POI row joined through trip_entry_pois. */
interface RawEntryPoi {
  id?: number | null;
  poiId?: number | null;
  sortOrder?: number | null;
  type?: string | null;
  name?: string | null;
  category?: string | null;
  maps?: string | null;
  lat?: number | null;
  lng?: number | null;
  googleRating?: number | null;
  rating?: number | null;
  hours?: string | null;
  price?: string | null;
  reservation?: string | null;
  reservationUrl?: string | null;
  description?: string | null;
  note?: string | null;
  /** v2.12 Wave 3：JSON-encoded TEXT — array of { url, thumbUrl?, caption?, source?, attribution? } */
  photos?: string | null;
}

type RawStopPoi = RawEntryPoi;

/** Raw timeline entry as returned by the API. */
interface RawEntry {
  id?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  title?: string | null;
  description?: string | null;
  // v2.x (migration 0078): entry-level note 已移除；note 來源改為 master stopPoi。
  source?: string | null;
  travel?: RawTravel | null;
  /** v2.27.0 multi-POI per entry — master (sort_order=1) JOIN pois。lat/lng 為新 SoT */
  master?: RawStopPoi | null;
  /** Canonical stop POI list; stop POI === first row (sortOrder=1). */
  stopPois?: RawStopPoi[];
  // v2.29.0: shopping field removed — shopping POI is now an alternate in stopPois (filter by type='shopping')
}

/* ===== Helpers ===== */

function buildLocation(
  maps?: string | null,
  name?: string | null,
  _lat?: number | null,
  _lng?: number | null,
): NavLocation | null {
  if (!maps && !_lat) return null;
  const isUrl = maps ? /^https?:/i.test(maps) : false;
  const nameValue: string | undefined =
    (name ?? undefined) || (!isUrl && maps ? maps : undefined) || undefined;
  return {
    name: nameValue,
    googleQuery: isUrl ? (maps ?? undefined) : undefined,
  };
}

function formatTravelText(travel: RawTravel): string {
  const desc = travel.desc || '';
  const min = travel.min ?? null;
  if (desc && min) return `${desc}（${min} 分）`;
  if (desc) return desc;
  if (min) return `${min} 分`;
  return '';
}

function getPrimaryStopPoi(stopPois: RawStopPoi[] | undefined): RawStopPoi | null {
  if (!stopPois || stopPois.length === 0) return null;
  return stopPois.find((p) => p.sortOrder === 1) ?? stopPois[0] ?? null;
}

function toStopPoiOption(p: RawStopPoi): StopPoiOptionData | null {
  const name = p.name?.trim();
  if (!name) return null;
  return {
    poiId: p.poiId ?? p.id ?? null,
    sortOrder: p.sortOrder ?? null,
    name,
    type: p.type ?? null,
    category: p.category ?? null,
    rating: p.googleRating ?? p.rating ?? null,
    hours: p.hours ?? null,
    price: p.price ?? null,
    reservation: p.reservation ?? null,
    reservationUrl: p.reservationUrl ?? null,
    description: p.description ?? null,
    note: p.note ?? null,
    location: buildLocation(p.maps ?? null, name, p.lat ?? null, p.lng ?? null),
  };
}

/* ===== Timeline Entry ===== */

export function toTimelineEntry(raw: RawEntry): TimelineEntryData {
  const travel = raw.travel ?? null;
  const travelData: TravelData | null = travel
    ? {
        type: travel.type || '',
        submode: travel.submode ?? null,
        sameplace: travel.sameplace === true,
        desc: travel.desc ?? null,
        min: travel.min ?? null,
        // v2.23.0 加 travel_distance_m col 時漏接到 mapDay → frontend
        // entry.travel.distanceM 永遠 undefined，TravelPill 顯示不出 km。
        distanceM: travel.distanceM ?? null,
        text: formatTravelText(travel),
      }
    : null;

  // stop 的 canonical POI 是 stopPois.sortOrder=1；migration 0059 guarantees the data.
  const poi = getPrimaryStopPoi(raw.stopPois);
  const effMaps = poi?.maps ?? null;
  // Migration 0045 (v2.19.x) 把 pois.google_rating 改名為 rating，但這裡的 mapping
  // 沒 follow up — entry.googleRating 永遠 null。Fallback 同時讀新舊 key 維持向前相容。
  // v2.33.38 round 3: 拔掉 `as { rating?... }` redundant cast — RawEntryPoi.rating 已 typed (line 104)。
  const effGoogleRating = poi?.googleRating ?? poi?.rating ?? null;
  // v2.12 Wave 3：parse pois.photos JSON 字串。malformed → 視為 null（不 throw）。
  const effPhotos: PoiPhoto[] | null = parsePhotos(poi?.photos);
  const stopPois = (raw.stopPois ?? [])
    .map(toStopPoiOption)
    .filter((p): p is StopPoiOptionData => p !== null)
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  const displayTitle = getStopDisplayTitle({
    poiName: poi?.name ?? null,
    poiType: poi?.type ?? null,
  });

  const locations: NavLocation[] = [];
  if (effMaps) {
    locations.push({
      name: displayTitle || undefined,
      googleQuery: effMaps || undefined,
    });
  }

  // master coord：使用 canonical stop POI。
  const masterLat = poi?.lat ?? null;
  const masterLng = poi?.lng ?? null;

  // v2.29.0: time DROPPED — 從 startTime/endTime 重組成顯示字串
  // v2.31.77 fix #196: 改 camelCase（deepCamel'd API response）+ surface
  // startTime/endTime 到 output 讓下游 parseEntryTime 能讀到（原本只 surface
  // composed `time` 但 TimelineRail 用 parseEntryTime 直接讀 startTime → 永遠空）。
  const composedTime = raw.startTime && raw.endTime
    ? `${raw.startTime}-${raw.endTime}`
    : (raw.startTime ?? null);

  return {
    id: raw.id ?? null,
    time: composedTime,
    startTime: raw.startTime ?? null,
    endTime: raw.endTime ?? null,
    displayTitle,
    title: null,
    description: raw.description ?? null,
    // v2.x (migration 0078): 「整體備註」來源從 entry-level trip_entries.note
    // 改成 primary stopPoi（master, sortOrder=1）的 per-POI trip_entry_pois.note。
    note: poi?.note ?? null,
    googleRating: effGoogleRating,
    source: raw.source ?? null,
    travel: travelData,
    poiType: poi?.type ?? null,
    locations: locations.length > 0 ? locations : null,
    stopPois: stopPois.length > 0 ? stopPois : null,
    photos: effPhotos,
    masterLat,
    masterLng,
  };
}

/**
 * Validate a photo URL allowing only https URLs. v2.33.44 round 6 security
 * audit: defense in depth — `pois.photos` is JSON column, and if any future
 * write path (custom POI photo upload, malicious enrichment) sneaks in
 * `javascript:` / `data:` URI, downstream `<img src>` / `<a href>` would
 * become XSS-on-click. Strip non-https from the moment we parse.
 */
function isSafePhotoUrl(u: unknown): u is string {
  return typeof u === 'string' && /^https:\/\//i.test(u);
}

/**
 * Parse `pois.photos` JSON-encoded TEXT column. Returns null on missing /
 * empty / malformed input — frontend then falls back to placeholder UI.
 */
function parsePhotos(raw: string | null | undefined): PoiPhoto[] | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid: PoiPhoto[] = parsed
      .filter((p): p is Record<string, unknown> => p != null && typeof p === 'object')
      .filter((p) => isSafePhotoUrl(p.url))
      .map((p) => ({
        url: p.url as string,
        thumbUrl: isSafePhotoUrl(p.thumbUrl) ? (p.thumbUrl as string) : undefined,
        caption: typeof p.caption === 'string' ? p.caption : undefined,
        source: isSafePhotoUrl(p.source) ? (p.source as string) : undefined,
        attribution: typeof p.attribution === 'string' ? p.attribution : undefined,
      }));
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}
