/**
 * Trip-related TypeScript interfaces.
 *
 * Field names use the frontend camelCase convention produced by mapRow()
 * (js/map-row.js). DB snake_case columns are renamed according to FIELD_MAP,
 * and _json suffix is stripped after JSON parsing.
 */

// ---------------------------------------------------------------------------
// Nested value types
// ---------------------------------------------------------------------------

/** Trip doc entry shape used by /api/trips/:id/docs/:key (export only,
 *  v2.17.17 後 sheet rendering 已移除,只剩 tripExport 用)。 */
export interface DocEntry {
  id?: number;
  sort_order?: number;
  section: string;
  title: string;
  content: string;
}

/** Location object stored in entries.location, parsed by API handler */
export interface Location {
  name?: string;
  lat?: number;
  lng?: number;
  googleQuery?: string;
  appleQuery?: string;
  mapcode?: string;
  geocodeStatus?: string;
}

/** Travel leg assembled from entries.travel_* columns (API auto-camelCases). */
export interface Travel {
  type: string;
  desc?: string | null;
  min?: number | null;
  /** Driving distance in meters (Google Routes API). NULL for legacy entries pre-v2.23.0. */
  distanceM?: number | null;
  /** 'google' / 'error' (travel_source col). NULL for legacy. */
  source?: string | null;
}

/** Parking object stored in hotels.parking (JSON parsed by mapRow) */
export interface Parking {
  info?: string;
  name?: string;
  price?: string;
  note?: string;
  maps?: string;
  mapcode?: string;
}

// Migration 0045 (2026-05-02): trips.footer column dropped + Footer component
// removed. The legacy `Footer` type lived here.

// ---------------------------------------------------------------------------
// Core data entities (after mapRow transformation)
// ---------------------------------------------------------------------------

/**
 * Shopping item — belongs to either a hotel or an entry.
 * DB columns: id, parent_type, parent_id, sort_order, name, category,
 *             hours, must_buy, note, rating, maps, mapcode, source
 */
export interface Shopping {
  id: number;
  parentType: 'hotel' | 'entry';
  parentId: number;
  sortOrder: number;
  name: string;
  category?: string | null;
  hours?: string | null;
  mustBuy?: string | null;
  note?: string | null;
  rating?: number | null;
  maps?: string | null;
  mapcode?: string | null;
  source?: string | null;
}

/**
 * Timeline entry (activity / spot).
 * DB table: trip_entries
 * v2.29.0 (migration 0062) DB columns: id, day_id, sort_order, start_time, end_time,
 *             title, description, source, note, entry_pois_version, updated_at
 * Notes:
 *   - travel object 由 trip_segments lookup 組裝（不再從 entry.travel_* cols）
 *   - master/alternates 由 trip_entry_pois lookup 組裝
 */
/**
 * Entry-bound POI (v2.27.0 multi-POI per entry)：
 * 從 trip_entry_pois JOIN pois 出來的 master / alternate 條目。`sortOrder` 在
 * Entry.alternates 內為 2, 3, ...；master 不在 alternates，sortOrder 隱含為 1。
 */
export interface EntryPoiInfo {
  poiId: number;
  name?: string | null;
  lat?: number | null;
  lng?: number | null;
  type?: string | null;
  category?: string | null;
  /** v2.28.0 — restaurant-shared attributes (POI master). */
  hours?: string | null;
  /** googleRating - from pois.rating column */
  rating?: number | null;
  /** v2.25.4 後 price 純 pois master */
  price?: string | null;
  /** v2.29.0 — trip_entry_pois metadata。NULL = 無 trip-specific 預約資訊。 */
  reservation?: string | null;
  reservationUrl?: string | null;
  /** trip_entry_pois metadata description / note */
  description?: string | null;
  note?: string | null;
}

export interface EntryPoiAlternate extends EntryPoiInfo {
  sortOrder: number;
}

export interface Entry {
  id: number;
  dayId?: number;
  sortOrder: number;
  time?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  title: string;
  description?: string | null;
  source?: string | null;
  note?: string | null;
  /** Assembled from trip_segments by API handler (v2.29.0). */
  travel?: Travel | null;
  /**
   * v2.27.0 multi-POI per entry：master POI（sort_order=1）。Phase 1 dual-read
   * 之後由 backend 直接從 trip_entry_pois populate。
   */
  master?: EntryPoiInfo | null;
  /**
   * v2.27.0 multi-POI per entry：alternates 列表，依 sort_order 升序。空陣列表示
   * 無 alternates；undefined 表示 backend 未 populate。
   */
  alternates?: EntryPoiAlternate[];
  /**
   * Canonical stop POI list. The stop's own POI is always the first item
   * (`sortOrder=1`); remaining rows are alternates.
   */
  stopPois?: EntryPoiAlternate[];
  /**
   * v2.27.0 OCC token = trip_entries.entry_pois_version (monotonic integer counter,
   * migration 0058). Only the 4 multi-POI mutating helpers bump it; unrelated
   * PATCH /entries note/time edits do NOT touch it. Client passes the token back
   * in PATCH /master / POST /alternates / DELETE /alternates / PATCH /alternates/reorder;
   * server compares and returns 409 STALE_ENTRY on mismatch. Serialized as string so
   * the JSON contract is type-stable (large counters would overflow JS Number eventually).
   */
  entryPoisVersion?: string;
  updatedAt?: string;
  shopping: Shopping[];
}

/**
 * Hotel — at most one per day.
 * v2.29.0: stored as pois (type=hotel) + trip_days.hotel_poi_id (FK).
 * This interface represents the merged view for frontend rendering.
 */
export interface Hotel {
  id: number;
  dayId?: number;
  name: string;
  checkout?: string | null;
  source?: string | null;
  description?: string | null;
  /** Parsed breakfast info — included flag + optional note */
  breakfast?: { included?: boolean; note?: string | null } | null;
  note?: string | null;
  parking?: Parking | null;
  location?: Location | null;
  shopping: Shopping[];
}

// ---------------------------------------------------------------------------
// POI types (normalized schema)
// ---------------------------------------------------------------------------

/** POI master record — source of truth, shared across trips. AI-maintained, user cannot edit directly. */
export interface Poi {
  id: number;
  type: 'hotel' | 'restaurant' | 'shopping' | 'parking' | 'attraction' | 'transport' | 'activity' | 'other';
  name: string;
  description?: string | null;
  note?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  hours?: string | null;
  googleRating?: number | null;
  category?: string | null;
  maps?: string | null;
  mapcode?: string | null;
  lat?: number | null;
  lng?: number | null;
  country?: string | null;
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Full day response from GET /api/trips/:id/days/:num
 * DB table: trip_days (renamed from days)
 * DB columns: id, trip_id, day_num, date, day_of_week, label, updated_at
 * Note: weather removed — derived at runtime from entries' locations + times
 */
export interface Day {
  id: number;
  dayNum: number;
  date?: string | null;
  dayOfWeek?: string | null;
  label?: string | null;
  /** Section 4.3 (terracotta-mockup-parity-v2)：user-defined day title (e.g.「Day 3 · 美瑛拼布之路」)
   *  從 trip_days.title 來，nullable。fallback chain: title || label || `Day N` */
  title?: string | null;
  updatedAt?: string;
  hotel: Hotel | null;
  timeline: Entry[];
}

/**
 * Lightweight day summary from GET /api/trips/:id/days (list)
 * Returns only: id, day_num, date, day_of_week, label
 */
export interface DaySummary {
  id: number;
  dayNum: number;
  date?: string | null;
  dayOfWeek?: string | null;
  label?: string | null;
  /** Section 4.3：user-defined day title (mirrors Day.title) */
  title?: string | null;
}


// ---------------------------------------------------------------------------
// Trip list / single trip
// ---------------------------------------------------------------------------

/**
 * Trip list item from GET /api/trips
 * Migration 0045 dropped self_drive/auto_scroll/footer/is_default. Added
 * data_source/default_travel_mode/lang. TripPage fallback now uses
 * `published === 1` instead of `isDefault === 1` (commit 18).
 */
export interface TripListItem {
  tripId: string;
  name: string;
  owner: string;
  title?: string | null;
  countries?: string | null;
  published: number;
  dataSource?: string | null;
  defaultTravelMode?: string | null;
  lang?: string | null;
}

/**
 * Trip destination row (multi-dest normalization, migration 0045 added trip_destinations).
 */
export interface TripDestination {
  dest_order: number;
  name: string;
  lat?: number | null;
  lng?: number | null;
  day_quota?: number | null;
  /** JSON-parsed array of sub-area names (e.g. ['梅田', '難波']) */
  sub_areas?: string[] | null;
  // v2.29.0: osm_id / osm_type DROPPED (migration 0062)
}

/**
 * Single trip from GET /api/trips/:id
 * Migration 0045 dropped og_description/self_drive/food_prefs/auto_scroll/footer/
 * is_default. Added data_source/default_travel_mode/lang + destinations join.
 */
export interface Trip {
  id: string;
  tripId: string;
  name: string;
  owner: string;
  title?: string | null;
  description?: string | null;
  countries?: string | null;
  published?: number | null;
  dataSource?: string | null;
  defaultTravelMode?: string | null;
  lang?: string | null;
  destinations?: TripDestination[];
  createdAt?: string;
  updatedAt?: string;
  // v2.23.8 self-drive (migration 0052) — 全 nullable，支援後補
  selfDriveEnabled?: number | null;            // 0 / 1
  selfDrivePickupAt?: string | null;           // ISO datetime YYYY-MM-DDTHH:MM
  selfDriveReturnAt?: string | null;           // ISO datetime
  selfDrivePickupLocation?: string | null;
  selfDriveReturnLocation?: string | null;
}
