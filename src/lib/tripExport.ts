/**
 * Trip export — JSON (round-trip) format. PDF lives in the component layer
 * (renderTripPrintPdf) because it renders a React component; this file is a leaf.
 *
 * v2.37.0 (PR2): CSV + Markdown export removed (unused). JSON export switched to
 * a round-trip schema { schemaVersion, meta, days, notes, segments } consumed by
 * the import feature (PR3) — segments are serialized by POSITIONAL entry index
 * (entry id is auto-increment and changes on import).
 */
import { apiFetch } from './apiClient';
import type { Trip } from '../types/trip';

/* ===== Helpers ===== */

function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sanitize a filename component: strip path separators, control chars, and
 * Windows-reserved characters. v2.33.36 security audit round 1 — `tripName`
 * came straight from user input (`a.download = "${tripName}-${date}.json"`),
 * which Safari historically interpreted as a path (download traversal).
 */
function safeFileBase(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const stripped = raw.replace(/[\\/\x00-\x1f<>:"|?*]/g, '_').trim();
  return stripped.slice(0, 80) || 'trip';
}

/** "{tripName}-{YYYY-MM-DD}" safe filename base, shared by JSON + PDF export. */
export function tripFileBase(trip: Trip | null): string {
  const tripName = trip?.name || 'trip';
  const today = new Date().toISOString().slice(0, 10);
  return safeFileBase(`${tripName}-${today}`);
}

/* ===== Round-trip JSON schema (v1) ===== */

export interface TripExportSegment {
  /** Positional index of the from-entry in the flattened trip-wide entry list.
   *  Always >= 0 in exported output — orphan segments (idx would be -1) are dropped
   *  by buildTripExportJson, never serialized. */
  fromEntryIdx: number;
  toEntryIdx: number;
  mode: string;
  min: number | null;
  distanceM: number | null;
  source: string | null;
}

export interface TripExportV1 {
  schemaVersion: 1;
  meta: Record<string, unknown>;
  /** Raw `?all=1` days; each timeline entry carries an added `entryPosition`. */
  days: Array<Record<string, unknown>>;
  /** 5-section trip notes (航班/住宿/預訂/行前須知/緊急聯絡). */
  notes: Record<string, unknown>;
  segments: TripExportSegment[];
}

const EMPTY_NOTES: Record<string, unknown> = {
  flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
};

const asArr = (v: unknown): Array<Record<string, unknown>> =>
  Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];

/**
 * Build the round-trip export object. PURE — unit-tested. Flattens entries in
 * day order (then timeline order, as `?all=1` returns them) to assign a stable
 * `entryPosition`, then re-keys every segment from auto-increment entry ids to
 * those positions so import can remap to fresh ids. Orphan segments (referencing
 * a missing entry) are dropped.
 */
export function buildTripExportJson(input: {
  meta: Record<string, unknown>;
  days: Array<Record<string, unknown>>;
  segments: Array<Record<string, unknown>>;
  notes: Record<string, unknown>;
}): TripExportV1 {
  const idToIdx = new Map<number, number>();
  let pos = 0;
  const days = input.days.map((d) => ({
    ...d,
    timeline: asArr(d.timeline).map((e) => {
      const entryPosition = pos++;
      if (typeof e.id === 'number') idToIdx.set(e.id, entryPosition);
      return { ...e, entryPosition };
    }),
  }));

  const segments: TripExportSegment[] = asArr(input.segments)
    .map((s) => {
      const from = typeof s.fromEntryId === 'number' ? idToIdx.get(s.fromEntryId) : undefined;
      const to = typeof s.toEntryId === 'number' ? idToIdx.get(s.toEntryId) : undefined;
      return {
        fromEntryIdx: from ?? -1,
        toEntryIdx: to ?? -1,
        mode: typeof s.mode === 'string' ? s.mode : '',
        min: typeof s.min === 'number' ? s.min : null,
        distanceM: typeof s.distanceM === 'number' ? s.distanceM : null,
        source: typeof s.source === 'string' ? s.source : null,
      };
    })
    .filter((s) => s.fromEntryIdx >= 0 && s.toEntryIdx >= 0);

  return { schemaVersion: 1, meta: input.meta, days, notes: input.notes ?? EMPTY_NOTES, segments };
}

async function fetchExportData(tripId: string) {
  const id = encodeURIComponent(tripId);
  // meta + days are the core structure — if either fails the export is meaningless,
  // so they stay fatal (Promise.all rejects). segments + notes are secondary
  // (a trip may legitimately have none / a 404), so they degrade to empty.
  const [meta, days, segments, notes] = await Promise.all([
    apiFetch<Record<string, unknown>>(`/trips/${id}`),
    apiFetch<Array<Record<string, unknown>>>(`/trips/${id}/days?all=1`),
    apiFetch<Array<Record<string, unknown>>>(`/trips/${id}/segments`).catch(() => []),
    apiFetch<Record<string, unknown>>(`/trips/${id}/notes`).catch(() => EMPTY_NOTES),
  ]);
  return { meta, days: asArr(days), segments: asArr(segments), notes: notes ?? EMPTY_NOTES };
}

/* ===== Public API ===== */

/** Download the trip as a round-trip JSON file. Throws on failure (caller toasts). */
export async function downloadTripJson(opts: { tripId: string; trip: Trip | null }): Promise<void> {
  const data = await fetchExportData(opts.tripId);
  const output = buildTripExportJson(data);
  downloadBlob(JSON.stringify(output, null, 2), `${tripFileBase(opts.trip)}.json`, 'application/json');
}
