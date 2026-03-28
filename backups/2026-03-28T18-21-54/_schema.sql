CREATE TABLE api_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT NOT NULL, path TEXT NOT NULL, status INTEGER NOT NULL, error TEXT, duration INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')))

CREATE TABLE audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         TEXT NOT NULL,
  table_name      TEXT NOT NULL,
  record_id       INTEGER,
  action          TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  changed_by      TEXT,
  request_id      INTEGER,
  diff_json       TEXT,
  snapshot        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
)

CREATE TABLE "hotels_legacy" (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id          INTEGER NOT NULL UNIQUE REFERENCES "trip_days"(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  checkout        TEXT,
  source          TEXT DEFAULT 'ai',
  description         TEXT,
  breakfast       TEXT,
  note            TEXT,
  parking    TEXT
, location_json TEXT)

CREATE TABLE poi_relations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  poi_id          INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  related_poi_id  INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  relation_type   TEXT NOT NULL CHECK (relation_type IN ('parking','nearby')),
  note            TEXT,
  UNIQUE(poi_id, related_poi_id, relation_type)
)

CREATE TABLE pois (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL CHECK (type IN ('hotel','restaurant','shopping','parking','attraction','transport','other')),
  name          TEXT NOT NULL,
  description   TEXT,
  note          TEXT,
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  website       TEXT,
  hours         TEXT,
  google_rating REAL,
  category      TEXT,
  maps          TEXT,
  mapcode       TEXT,
  lat           REAL,
  lng           REAL,
  country       TEXT DEFAULT 'JP',
  source        TEXT DEFAULT 'ai',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
)

CREATE TABLE "restaurants_legacy" (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id        INTEGER NOT NULL REFERENCES "trip_entries"(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  name            TEXT NOT NULL,
  category        TEXT,
  hours           TEXT,
  price           TEXT,
  reservation     TEXT,
  reservation_url TEXT,
  description     TEXT,
  note            TEXT,
  rating          REAL,
  maps            TEXT,
  mapcode         TEXT,
  source          TEXT DEFAULT 'ai'
)

CREATE TABLE "shopping_legacy" (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_type     TEXT NOT NULL CHECK (parent_type IN ('hotel', 'entry')),
  parent_id       INTEGER NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  name            TEXT NOT NULL,
  category        TEXT,
  hours           TEXT,
  must_buy        TEXT,
  note            TEXT,
  rating          REAL,
  maps            TEXT,
  mapcode         TEXT,
  source          TEXT DEFAULT 'ai'
)

CREATE TABLE "trip_days" (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_num         INTEGER NOT NULL,
  date            TEXT,
  day_of_week     TEXT,
  label           TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(trip_id, day_num)
)

CREATE TABLE trip_docs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('flights','checklist','backup','suggestions','emergency')),
  content         TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(trip_id, doc_type)
)

CREATE TABLE "trip_entries" (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id          INTEGER NOT NULL REFERENCES "trip_days"(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL,
  time            TEXT,
  title           TEXT NOT NULL,
  description            TEXT,
  source          TEXT DEFAULT 'ai',
  maps            TEXT,
  mapcode         TEXT,
  google_rating          REAL,
  note            TEXT,
  travel_type     TEXT,
  travel_desc     TEXT,
  travel_min      INTEGER,
  location   TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
)

CREATE TABLE "trip_permissions" (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  email   TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  role    TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  UNIQUE(email, trip_id)
)

CREATE TABLE trip_pois (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id             TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  poi_id              INTEGER NOT NULL REFERENCES pois(id),
  context             TEXT NOT NULL CHECK (context IN ('hotel','timeline','shopping')),
  day_id              INTEGER REFERENCES trip_days(id) ON DELETE CASCADE,
  entry_id            INTEGER REFERENCES trip_entries(id) ON DELETE CASCADE,
  sort_order          INTEGER DEFAULT 0,
  description         TEXT,
  note                TEXT,
  hours               TEXT,
  checkout            TEXT,
  breakfast_included  INTEGER,
  breakfast_note      TEXT,
  price               TEXT,
  reservation         TEXT,
  reservation_url     TEXT,
  must_buy            TEXT,
  source              TEXT DEFAULT 'ai',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (context = 'hotel' AND day_id IS NOT NULL) OR
    (context IN ('timeline','shopping') AND (entry_id IS NOT NULL OR day_id IS NOT NULL))
  )
)

CREATE TABLE "trip_requests" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('trip-edit', 'trip-plan')),
  message TEXT NOT NULL,
  submitted_by TEXT,
  reply TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'received', 'processing', 'completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_by TEXT DEFAULT NULL
)

CREATE TABLE trips (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  owner           TEXT NOT NULL,
  title           TEXT,
  description     TEXT,
  og_description  TEXT,
  self_drive      INTEGER DEFAULT 0,
  countries       TEXT DEFAULT 'JP',
  published       INTEGER DEFAULT 1,
  food_prefs      TEXT,
  auto_scroll     TEXT,
  footer     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
, is_default INTEGER DEFAULT 0)

