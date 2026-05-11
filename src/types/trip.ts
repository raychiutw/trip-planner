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
 * Restaurant recommendation — belongs to an entry.
 * DB columns: id, entry_id, sort_order, name, category, hours, price,
 *             reservation, reservation_url, description, note, rating,
 *             maps, mapcode, source
 */
export interface Restaurant {
  id: number;
  entryId: number;
  sortOrder: number;
  name: string;
  category?: string | null;
  hours?: string | null;
  price?: string | null;
  reservation?: string | null;
  reservationUrl?: string | null;
  /** maps to DB `description` column directly (no rename in FIELD_MAP) */
  description?: string | null;
  note?: string | null;
  /** maps to DB `rating` (googleRating alias not applied here — FIELD_MAP maps `rating` -> `googleRating`) */
  googleRating?: number | null;
  maps?: string | null;
  mapcode?: string | null;
  lat?: number | null;
  lng?: number | null;
  source?: string | null;
}

/**
 * Timeline entry (activity / spot).
 * DB table: trip_entries
 * DB columns: id, day_id, sort_order, time, title, description, source, maps,
 *             mapcode, google_rating, note, travel_type, travel_desc, travel_min,
 *             location, updated_at
 * Notes:
 *   - location → parsed by mapRow JSON_FIELDS
 *   - travel_* cols → assembled into travel object by API handler
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
  /** Assembled from travel_type / travel_desc / travel_min columns */
  travel?: Travel | null;
  /**
   * @deprecated v2.27.0：master 改走 trip_entry_pois.sort_order=1。
   * Phase 1 dual-read，Phase 2 (v2.27.1) DROP COLUMN 後此欄位移除。
   * 過渡期讀新 code 走 `getEntryMasterPoiId(entry)` selector。
   */
  poiId?: number | null;
  /**
   * @deprecated v2.27.0：master POI 改走 `entry.master`。
   * Phase 1 dual-read，Phase 2 移除。過渡期讀新 code 走 `getEntryMaster(entry)`。
   */
  poi?: Poi | null;
  /**
   * v2.27.0 multi-POI per entry：master POI（sort_order=1）。Phase 1 dual-read
   * fallback：若 backend 未 populate，selector 會自動 fall back 到 legacy `poi`。
   */
  master?: EntryPoiInfo | null;
  /**
   * v2.27.0 multi-POI per entry：alternates 列表，依 sort_order 升序。空陣列表示
   * 無 alternates；undefined 表示 backend 尚未 populate（legacy response shape）。
   */
  alternates?: EntryPoiAlternate[];
  /**
   * v2.27.0 OCC token：MAX(updated_at) across trip_entry_pois rows for this entry。
   * Client 在 PATCH /master 等 mutating endpoint 帶回，server 比對偵測 stale write。
   */
  entryPoisVersion?: string;
  updatedAt?: string;
  restaurants: Restaurant[];
  shopping: Shopping[];
}

/**
 * Hotel — at most one per day.
 * Now stored as pois (type=hotel) + trip_pois (context=hotel).
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

/** Trip-specific POI reference (fork) — user can override description/note/hours */
export interface TripPoi {
  id: number;
  tripId: string;
  poiId: number;
  context: 'hotel' | 'timeline' | 'shopping';
  dayId?: number | null;
  entryId?: number | null;
  sortOrder: number;
  /** Override description (NULL = inherit master) */
  description?: string | null;
  /** Trip-specific note */
  note?: string | null;
  /** Override hours (NULL = inherit master) */
  hours?: string | null;
  /** Hotel-specific (flattened) */
  checkout?: string | null;
  breakfastIncluded?: number | null;
  breakfastNote?: string | null;
  /** Restaurant-specific (flattened) */
  price?: string | null;
  reservation?: string | null;
  reservationUrl?: string | null;
  /** Shopping-specific (flattened) */
  mustBuy?: string | null;
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Merged POI view — COALESCE(trip_pois.field, pois.field), frontend reads directly */
export interface MergedPoi extends Poi {
  sortOrder: number;
  tripPoiId: number;
  context: 'hotel' | 'timeline' | 'shopping';
  dayId?: number | null;
  entryId?: number | null;
  /** Hotel-specific (from trip_pois flattened columns) */
  checkout?: string | null;
  breakfastIncluded?: number | null;
  breakfastNote?: string | null;
  /** Restaurant-specific */
  price?: string | null;
  reservation?: string | null;
  reservationUrl?: string | null;
  /** Shopping-specific */
  mustBuy?: string | null;
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
  osm_id?: number | null;
  osm_type?: 'node' | 'way' | 'relation' | null;
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
