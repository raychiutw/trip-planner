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

/** Weather object stored in days.weather_json, exposed as `weather` */
export interface Weather {
  icon?: string;
  desc?: string;
  high?: number | string;
  low?: number | string;
  [key: string]: unknown;
}

/** Location object stored in entries.location_json, exposed as `location` */
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

/** Parking object stored in hotels.parking_json, exposed as `parking` */
export interface Parking {
  info?: string;
  [key: string]: unknown;
}

/**
 * Footer object stored in trips.footer_json, exposed as `footer`.
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
 * DB columns: id, day_id, sort_order, time, title, body, source, maps,
 *             mapcode, rating, note, travel_type, travel_desc, travel_min,
 *             location_json, updated_at
 * Notes:
 *   - body          -> description  (FIELD_MAP)
 *   - rating        -> googleRating (FIELD_MAP)
 *   - location_json -> location     (JSON parsed + _json stripped)
 *   - travel_* cols -> travel       (assembled in [num].ts GET handler)
 */
export interface Entry {
  id: number;
  dayId?: number;
  sortOrder: number;
  time?: string | null;
  title: string;
  /** DB column `body`, renamed via FIELD_MAP */
  description?: string | null;
  source?: string | null;
  maps?: string | null;
  mapcode?: string | null;
  /** DB column `rating`, renamed via FIELD_MAP */
  googleRating?: number | null;
  note?: string | null;
  /** Assembled from travel_type / travel_desc / travel_min columns */
  travel?: Travel | null;
  /** DB column `location_json`, parsed + _json stripped */
  location?: Location | null;
  updatedAt?: string;
  restaurants: Restaurant[];
  shopping: Shopping[];
}

/**
 * Hotel — at most one per day.
 * DB columns: id, day_id, name, checkout, source, details, breakfast,
 *             note, parking_json
 * Notes:
 *   - parking_json -> parking (JSON parsed + _json stripped)
 *   - breakfast is listed in JSON_FIELDS so it's also parsed if stored as JSON
 */
export interface Hotel {
  id: number;
  dayId?: number;
  name: string;
  checkout?: string | null;
  source?: string | null;
  details?: string | null;
  /** May be a string or parsed JSON object (listed in JSON_FIELDS) */
  breakfast?: string | object | null;
  note?: string | null;
  /** DB column `parking_json`, parsed + _json stripped */
  parking?: Parking | null;
  /** DB column `location_json`, parsed + _json stripped */
  location?: Location | null;
  shopping: Shopping[];
}

/**
 * Full day response from GET /api/trips/:id/days/:num
 * DB columns: id, trip_id, day_num, date, day_of_week, label, weather_json, updated_at
 * Notes:
 *   - day_of_week  -> dayOfWeek  (FIELD_MAP)
 *   - day_num      -> dayNum     (FIELD_MAP)
 *   - weather_json -> weather    (JSON parsed + _json stripped)
 *   - id and trip_id are stripped from dayFields; id re-added at top level
 */
export interface Day {
  id: number;
  dayNum: number;
  date?: string | null;
  dayOfWeek?: string | null;
  label?: string | null;
  /** DB column `weather_json`, parsed + _json stripped */
  weather?: Weather | null;
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
 *                    published, auto_scroll, footer_json
 * Notes:
 *   - footer_json is NOT parsed at this endpoint (raw string)
 *   - self_drive, published are SQLite INTEGER (0|1)
 *   - auto_scroll -> autoScroll (FIELD_MAP, if mapRow applied; raw at this endpoint)
 */
export interface TripListItem {
  tripId: string;
  name: string;
  owner: string;
  title?: string | null;
  /** DB column `self_drive` (INTEGER 0|1) */
  self_drive: number;
  countries?: string | null;
  published: number;
  /** DB column `auto_scroll` */
  auto_scroll?: string | null;
  /** DB column `footer_json` — raw JSON string at list endpoint */
  footer_json?: string | null;
}

/**
 * Single trip from GET /api/trips/:id
 * Full trips row with all columns, plus:
 *   - tripId alias added (= id)
 *   - footer_json parsed to Footer object if valid JSON
 */
export interface Trip {
  id: string;
  /** Alias of id, added by the handler */
  tripId: string;
  name: string;
  owner: string;
  title?: string | null;
  description?: string | null;
  ogDescription?: string | null;
  /** DB column `self_drive` (INTEGER 0|1) */
  selfDrive?: number | null;
  countries?: string | null;
  published?: number | null;
  foodPrefs?: string | null;
  autoScroll?: string | null;
  /** DB column `footer_json` — parsed to object by handler if valid JSON */
  footer?: Footer | string | null;
  createdAt?: string;
  updatedAt?: string;
}
