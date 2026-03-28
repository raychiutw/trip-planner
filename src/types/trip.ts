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

/** Location object stored in entries.location, exposed as `location` */
export interface Location {
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

/** Travel leg assembled from entries.travel_type / travel_desc / travel_min */
export interface Travel {
  type: string;
  desc?: string | null;
  min?: number | null;
}

/** Parking object stored in hotels.parking (JSON parsed by mapRow) */
export interface Parking {
  info?: string;
  [key: string]: unknown;
}

/**
 * Footer object stored in trips.footer (JSON parsed by mapRow).
 * Shape is free-form JSON, but common keys are listed here.
 */
export interface Footer {
  note?: string;
  [key: string]: unknown;
}

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
  /** 'hotel' | 'entry' */
  parentType: string;
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
export interface Entry {
  id: number;
  dayId?: number;
  sortOrder: number;
  time?: string | null;
  title: string;
  description?: string | null;
  source?: string | null;
  maps?: string | null;
  mapcode?: string | null;
  googleRating?: number | null;
  note?: string | null;
  /** Assembled from travel_type / travel_desc / travel_min columns */
  travel?: Travel | null;
  location?: Location | null;
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
  /** May be a string or parsed JSON object */
  breakfast?: string | object | null;
  note?: string | null;
  parking?: Parking | null;
  location?: Location | null;
  shopping: Shopping[];
}

// ---------------------------------------------------------------------------
// POI types (normalized schema)
// ---------------------------------------------------------------------------

/** POI master record — source of truth, shared across trips */
export interface Poi {
  id: number;
  type: 'hotel' | 'restaurant' | 'shopping' | 'parking' | 'attraction' | 'transport' | 'other';
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
  location?: Location | null;
  /** Type-specific fields (hotel: checkout/breakfast/parking, restaurant: price/reservation, shopping: mustBuy) */
  attrs?: Record<string, unknown> | null;
  country?: string | null;
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Trip-specific POI reference (fork) — overridable fields */
export interface TripPoi {
  id: number;
  tripId: string;
  poiId: number;
  context: 'hotel' | 'timeline' | 'shopping';
  dayId?: number | null;
  entryId?: number | null;
  sortOrder: number;
  /** Override description (NULL = use master) */
  description?: string | null;
  /** Trip-specific note (never synced to master) */
  note?: string | null;
  /** Override hours (NULL = use master) */
  hours?: string | null;
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Merged POI view — API returns COALESCE'd values, frontend reads directly */
export interface MergedPoi extends Poi {
  sortOrder: number;
  tripPoiId: number;
  context: 'hotel' | 'timeline' | 'shopping';
  dayId?: number | null;
  entryId?: number | null;
  /** Trip-specific attrs (checkout, breakfast, reservation, etc.) */
  tripAttrs?: Record<string, unknown> | null;
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
  /** DB column `day_num` — not renamed via mapRow at this endpoint */
  day_num: number;
  date?: string | null;
  day_of_week?: string | null;
  label?: string | null;
}

/**
 * Trip document from GET /api/trips/:id/docs/:type
 * DB columns: doc_type, content, updated_at (trip_id not returned)
 */
export interface TripDoc {
  /** One of: 'flights' | 'checklist' | 'backup' | 'suggestions' | 'emergency' */
  docType: string;
  content: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Trip list / single trip
// ---------------------------------------------------------------------------

/**
 * Trip list item from GET /api/trips
 * Columns projected: id AS tripId, name, owner, title, self_drive, countries,
 *                    published, auto_scroll, footer
 */
export interface TripListItem {
  tripId: string;
  name: string;
  owner: string;
  title?: string | null;
  selfDrive: number;
  countries?: string | null;
  published: number;
  autoScroll?: string | null;
  /** Raw JSON string at list endpoint (parsed by mapRow if passed through) */
  footer?: string | null;
  isDefault?: number;
}

/**
 * Single trip from GET /api/trips/:id
 */
export interface Trip {
  id: string;
  tripId: string;
  name: string;
  owner: string;
  title?: string | null;
  description?: string | null;
  ogDescription?: string | null;
  selfDrive?: number | null;
  countries?: string | null;
  published?: number | null;
  foodPrefs?: string | null;
  autoScroll?: string | null;
  footer?: Footer | string | null;
  createdAt?: string;
  updatedAt?: string;
}
