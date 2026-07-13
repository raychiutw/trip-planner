/**
 * tripPrintData — data model + loader + pure formatters for the print document.
 *
 * The print document (`/trip/:id/print`, <TripPrintDocument>) renders from data,
 * NOT from the live interactive TripPage DOM. That decouples it from accordion /
 * collapse state — the root cause of the old print/PDF "collapsed content" bug.
 *
 * Design: ~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260530-101432.md
 * Mockup: docs/design-sessions/2026-05-30-trip-print-document.html (Variant A)
 */
import { apiFetch } from './apiClient';
import { toTimelineEntry } from './mapDay';
import { travelMethodLabel } from './travelMode';

/* ===== Data model (camelCase — apiFetch deep-camels API responses) ===== */

export interface PrintTravel {
  type?: string | null;
  /** transit 細分方式（monorail/bus/…或「其他」自由文字）；用於顯示具體方式 label。 */
  submode?: string | null;
  /** v2.55.46: true = 免交通段（no_travel）→ 顯示「不需計算路程」而非車程。 */
  sameplace?: boolean;
  min?: number | null;
  distanceM?: number | null;
  desc?: string | null;
}
export interface PrintEntryPoi {
  sortOrder: number;
  name: string;
  type?: string | null;
  category?: string | null;
  rating?: number | null;
  price?: string | null;
  hours?: string | null;
  note?: string | null;
}
export interface PrintEntry {
  time?: string | null;
  title: string;
  rating?: number | null;
  description?: string | null;
  note?: string | null;
  travel?: PrintTravel | null;
  stopPois?: PrintEntryPoi[];
}
export interface PrintHotel {
  name: string;
  rating?: number | null;
  note?: string | null;
  checkout?: string | null;
}
export interface PrintDay {
  dayNum: number;
  date?: string | null;
  dayOfWeek?: string | null;
  label?: string | null;
  timeline: PrintEntry[];
  hotel?: PrintHotel | null;
}

export interface PrintFlight { airline?: string; flightNo?: string; cabinClass?: string; departAirport?: string; arriveAirport?: string; departAt?: string; arriveAt?: string; note?: string; }
export interface PrintLodging { name?: string; address?: string; checkInAt?: string; checkOutAt?: string; bookingNo?: string; phone?: string; note?: string; }
export interface PrintReservation { kind?: string; title?: string; reservedAt?: string; partySize?: number; reservationNo?: string; phone?: string; note?: string; }
export interface PrintPretripNote { section?: string; title?: string; content?: string; }
export interface PrintEmergencyContact { name?: string; relationship?: string; phone?: string; email?: string; kind?: string; }

export interface PrintNotes {
  flights: PrintFlight[];
  lodgings: PrintLodging[];
  reservations: PrintReservation[];
  pretripNotes: PrintPretripNote[];
  emergencyContacts: PrintEmergencyContact[];
}

export interface TripPrintData {
  name: string;
  title?: string | null;
  destinations?: string;
  dateRange?: string;
  days: PrintDay[];
  notes: PrintNotes;
}

/* ===== Pure formatters ===== */

/**
 * Canonical display name: `title || name`. Uses `||` (not `??`) so an empty-string
 * title falls through to name — the exact bug fixed in v2.34.47 for destination-named
 * trips (title === '', name carries the label).
 */
export function tripDisplayName(meta: { title?: string | null; name?: string | null }): string {
  return meta.title?.trim() || meta.name?.trim() || '未命名行程';
}

// Mirror TravelPill MODE_LABEL: backend raw entry.travel.type is car/walk/etc.
// (mapped from driving/walking in _merge.ts:271), NOT the canonical 3 — so the
// common driving/walking case must alias or it prints the English token.
const TRAVEL_MODE_LABEL: Record<string, string> = {
  driving: '開車', car: '開車', drive: '開車',
  walking: '步行', walk: '步行',
  transit: '大眾運輸', bus: '公車',
  train: '火車', metro: '捷運', subway: '捷運',
  ferry: '渡輪', flight: '飛機', plane: '飛機',
};

/** "開車 · 12 分 · 2.1km" — empty string when there is no travel to print. */
export function formatTravelLine(travel: PrintTravel | null | undefined): string {
  if (!travel) return '';
  // v2.55.46: 免交通 → 列印/分享面收合成「不需計算路程」，不顯示車程。
  if (travel.sameplace) return '不需計算路程';
  const rawType = (travel.type ?? '').trim();
  const hasMin = typeof travel.min === 'number' && travel.min > 0;
  const hasDist = typeof travel.distanceM === 'number' && travel.distanceM > 0;
  if (!rawType && !hasMin && !hasDist) return '';
  const parts: string[] = [];
  // v2.55.45: transit 帶 submode → 用 travelMethodLabel（SSoT，含單軌/公車/地鐵/火車/
  // 高鐵 + 其他自由文字 passthrough），與 picker 一致；否則回退 3-mode label。
  if (travel.submode) parts.push(travelMethodLabel('transit', travel.submode));
  else if (rawType) parts.push(TRAVEL_MODE_LABEL[rawType] ?? rawType);
  if (hasMin) parts.push(`${travel.min} 分`);
  if (hasDist) parts.push(`${(travel.distanceM! / 1000).toFixed(1)}km`);
  return parts.join(' · ');
}

/** "2026-07-26 – 2026-07-30" (first–last dated day), or single date, or ''. */
export function formatDateRange(days: PrintDay[]): string {
  const dated = days.filter((d) => d.date).map((d) => d.date as string);
  if (dated.length === 0) return '';
  const first = dated[0]!;
  const last = dated[dated.length - 1]!;
  return first === last ? first : `${first} – ${last}`;
}

/* ===== Loader ===== */

type Raw = Record<string, unknown>;
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const str = (v: unknown): string | undefined => (v == null ? undefined : String(v));

const EMPTY_NOTES: PrintNotes = {
  flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
};

/**
 * Map one raw `?all=1` timeline entry → PrintEntry via the canonical
 * `toTimelineEntry` mapper (so time/title/rating/travel match exactly what the
 * interactive timeline shows): time is composed from startTime/endTime (the
 * `time` column was dropped in v2.29.0), title is the primary POI name, and
 * rating lives on the master stop POI — none of which are direct entry columns.
 */
function mapEntry(e: Raw): PrintEntry {
  const t = toTimelineEntry(e as unknown as Parameters<typeof toTimelineEntry>[0]);
  // TimelineEntryData.travel is TravelData | string | null (legacy string form).
  const tv = t.travel && typeof t.travel === 'object' ? t.travel : null;
  // migration 0078：entry-level `trip_entries.note` 欄位已 DROP，列印頁 entry 備註
  // 改取 master（primary stopPoi, sortOrder=1）的 per-POI note。明確從 stopPois 取
  // master，避免未來重構讓 entry 備註誤抓 alternate（sortOrder>1）或殘留欄位。
  const masterStop = (t.stopPois ?? []).find((p) => p.sortOrder === 1) ?? null;
  const masterNote = masterStop?.note ?? null;
  return {
    time: t.time ?? undefined,
    title: t.displayTitle || '',
    rating: t.googleRating,
    description: t.description ?? undefined,
    note: masterNote ?? undefined,
    travel: tv ? { type: tv.type, submode: tv.submode, sameplace: tv.sameplace, min: tv.min, distanceM: tv.distanceM } : null,
    stopPois: (t.stopPois ?? []).map((p) => ({
      sortOrder: p.sortOrder ?? 1,
      name: p.name ?? '',
      type: p.type ?? undefined,
      category: p.category ?? undefined,
      rating: p.rating,
      price: p.price ?? undefined,
      hours: p.hours ?? undefined,
      note: p.note ?? undefined,
    })),
  };
}

function mapPrintDay(d: Raw): PrintDay {
  const h = d.hotel && typeof d.hotel === 'object' ? (d.hotel as Raw) : null;
  return {
    dayNum: num(d.dayNum) ?? 0,
    date: str(d.date),
    dayOfWeek: str(d.dayOfWeek),
    label: str(d.label),
    timeline: arr(d.timeline).map(mapEntry),
    hotel: h && h.name ? { name: String(h.name), rating: num(h.googleRating) ?? num(h.rating), note: str(h.note), checkout: str(h.checkout) } : null,
  };
}

function mapNotes(raw: Raw | null): PrintNotes {
  if (!raw) return EMPTY_NOTES;
  return {
    flights: arr(raw.flights) as PrintFlight[],
    lodgings: arr(raw.lodgings) as PrintLodging[],
    reservations: arr(raw.reservations) as PrintReservation[],
    pretripNotes: arr(raw.pretripNotes) as PrintPretripNote[],
    emergencyContacts: arr(raw.emergencyContacts) as PrintEmergencyContact[],
  };
}

/**
 * Pure mapper: raw {meta, days, notes} → TripPrintData. Shared by the authed print
 * loader and the public share loader so both render byte-identical documents through
 * one mapping path (the server-side share endpoint deliberately returns the SAME raw
 * days?all=1 shape so this single mapper — incl. toTimelineEntry — is reused, never
 * re-implemented in the Worker).
 */
export function mapRawToPrintData(meta: Raw, daysRaw: unknown, notesRaw: Raw | null): TripPrintData {
  const days = arr(daysRaw).map(mapPrintDay);
  const destArr = arr(meta.destinations).map((dd) => str(dd.name)).filter(Boolean) as string[];
  return {
    name: String(meta.name ?? ''),
    title: str(meta.title) ?? null,
    destinations: destArr.length > 0 ? destArr.join(' · ') : str(meta.countries),
    dateRange: formatDateRange(days),
    days,
    notes: mapNotes(notesRaw),
  };
}

/**
 * Load everything the print document needs in parallel:
 * trip meta + days (with timeline/travel/hotel) + 5-section trip notes.
 * Notes failure is non-fatal (older trips may 404) → empty notes.
 */
export async function loadTripPrintData(tripId: string): Promise<TripPrintData> {
  const id = encodeURIComponent(tripId);
  const [meta, daysRaw, notesRaw] = await Promise.all([
    apiFetch<Raw>(`/trips/${id}`),
    apiFetch<Raw[]>(`/trips/${id}/days?all=1`),
    apiFetch<Raw>(`/trips/${id}/notes`).catch(() => null),
  ]);
  return mapRawToPrintData(meta, daysRaw, notesRaw);
}

export interface SharePrintData {
  data: TripPrintData;
  /** Owner display_name for the「由 X 分享」hero ('' when not set / anonymous). */
  sharedBy: string;
}

/**
 * Public share loader (no auth): one call to GET /api/share/:token returns the
 * already section-filtered {meta, days, notes}. Maps via the shared mapper. apiFetch
 * throws on 404 (invalid / revoked / expired token) — caller shows a not-found state.
 */
export async function loadSharePrintData(token: string): Promise<SharePrintData> {
  const res = await apiFetch<{ meta: Raw; days: unknown; notes: Raw }>(`/share/${encodeURIComponent(token)}`);
  return {
    data: mapRawToPrintData(res.meta, res.days, res.notes),
    sharedBy: str(res.meta?.sharedBy) ?? '',
  };
}
