#!/usr/bin/env node
/**
 * migrate-pois.js — Migrate hotels/restaurants/shopping → pois + trip_pois
 *
 * Reads from D1 (or backup JSON with --from-backup), deduplicates by normalized
 * name, inserts into `pois` and `trip_pois`, then renames old tables to *_legacy.
 *
 * Usage:
 *   node scripts/migrate-pois.js [--dry-run] [--local] [--from-backup <dir>]
 *
 * Flags:
 *   --dry-run      Print what would be done without writing to D1
 *   --local        Use `wrangler d1 execute --local` instead of --remote
 *   --from-backup  Read source data from backup JSON files instead of D1
 *                  e.g. --from-backup backups/2026-03-28T01-36-39
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LOCAL = args.includes('--local');
const backupIdx = args.indexOf('--from-backup');
const BACKUP_DIR = backupIdx !== -1 ? path.resolve(args[backupIdx + 1]) : null;

const DB_NAME = 'trip-planner-db';
const ENV_FLAG = LOCAL ? '--local' : '--remote';

console.log(`migrate-pois.js`);
console.log(`  dry-run:  ${DRY_RUN}`);
console.log(`  target:   ${LOCAL ? 'local' : 'remote'}`);
console.log(`  source:   ${BACKUP_DIR ? `backup (${BACKUP_DIR})` : 'D1 live'}`);
console.log('');

// ---------------------------------------------------------------------------
// Helpers: D1 interaction
// ---------------------------------------------------------------------------

/** Execute a SQL command against D1 and return the parsed results array. */
function d1Query(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute ${DB_NAME} ${ENV_FLAG} --command "${escaped}" --json`;
  const raw = execSync(cmd, { encoding: 'utf8', timeout: 60000 });
  const jsonStart = raw.indexOf('[');
  if (jsonStart === -1) throw new Error(`No JSON in wrangler output: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(raw.slice(jsonStart));
  return parsed[0]?.results || [];
}

/** Execute a SQL command against D1 (no return value needed). */
function d1Exec(sql) {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN SQL] ${sql.slice(0, 120)}${sql.length > 120 ? '...' : ''}`);
    return;
  }
  const escaped = sql.replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute ${DB_NAME} ${ENV_FLAG} --command "${escaped}"`;
  execSync(cmd, { encoding: 'utf8', timeout: 60000 });
}

/**
 * Execute multiple SQL statements in a single wrangler call using --file.
 * Writes statements to a temp file, executes, then cleans up.
 */
function d1ExecBatch(statements) {
  if (statements.length === 0) return;
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would execute ${statements.length} SQL statements`);
    for (const s of statements.slice(0, 5)) {
      console.log(`    ${s.slice(0, 120)}${s.length > 120 ? '...' : ''}`);
    }
    if (statements.length > 5) console.log(`    ... and ${statements.length - 5} more`);
    return;
  }
  const tmpFile = path.join(__dirname, `_migrate_pois_batch_${Date.now()}.sql`);
  try {
    fs.writeFileSync(tmpFile, statements.join('\n'));
    const cmd = `npx wrangler d1 execute ${DB_NAME} ${ENV_FLAG} --file "${tmpFile}"`;
    execSync(cmd, { encoding: 'utf8', timeout: 120000 });
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// ---------------------------------------------------------------------------
// Helpers: read source data
// ---------------------------------------------------------------------------

function readTable(tableName) {
  if (BACKUP_DIR) {
    const filePath = path.join(BACKUP_DIR, `${tableName}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`  Warning: ${filePath} not found, returning empty array`);
      return [];
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return d1Query(`SELECT * FROM ${tableName};`);
}

// ---------------------------------------------------------------------------
// Helpers: name normalization for dedup
// ---------------------------------------------------------------------------

/**
 * Normalize a name for dedup comparison:
 *   1. Full-width alphanumeric → half-width (Ａ→A, １→1)
 *   2. Full-width space (U+3000) → half-width space
 *   3. Full-width punctuation → half-width equivalents
 *   4. Collapse multiple spaces into one, trim
 *   5. Lowercase
 *   6. Strip trailing 「店」 for comparison only
 */
function normalizeName(name) {
  if (!name) return '';
  let s = name;

  // Full-width alphanumeric → half-width (U+FF01..U+FF5E → U+0021..U+007E)
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  );

  // Full-width space → half-width
  s = s.replace(/\u3000/g, ' ');

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();

  // Lowercase
  s = s.toLowerCase();

  // Strip trailing 「店」 for comparison
  s = s.replace(/店$/, '');

  return s;
}

// ---------------------------------------------------------------------------
// Helpers: merge logic
// ---------------------------------------------------------------------------

/** Pick the more complete (non-null, non-empty) value between two. */
function pickBest(a, b) {
  if (a === null || a === undefined || a === '') return b;
  if (b === null || b === undefined || b === '') return a;
  // Prefer longer strings (more detail)
  if (typeof a === 'string' && typeof b === 'string') {
    return a.length >= b.length ? a : b;
  }
  return a;
}

/** Generate a UUID v4 for POI ids. */
function uuid() {
  return crypto.randomUUID();
}

/** Escape a string for SQL single-quote literals. */
function sqlStr(val) {
  if (val === null || val === undefined) return 'NULL';
  const s = String(val).replace(/'/g, "''");
  return `'${s}'`;
}

/** Escape a number or null. */
function sqlNum(val) {
  if (val === null || val === undefined) return 'NULL';
  return String(val);
}

// ---------------------------------------------------------------------------
// Build lookup maps
// ---------------------------------------------------------------------------

console.log('Reading source data...');
const hotels = readTable('hotels');
const restaurants = readTable('restaurants');
const shopping = readTable('shopping');
const days = readTable('days');
const entries = readTable('entries');

console.log(`  hotels:      ${hotels.length} rows`);
console.log(`  restaurants: ${restaurants.length} rows`);
console.log(`  shopping:    ${shopping.length} rows`);
console.log(`  days:        ${days.length} rows`);
console.log(`  entries:     ${entries.length} rows`);
console.log('');

// day_id → { trip_id, day_num }
const dayMap = new Map();
for (const d of days) {
  dayMap.set(d.id, { trip_id: d.trip_id, day_num: d.day_num });
}

// entry_id → { day_id }
const entryMap = new Map();
for (const e of entries) {
  entryMap.set(e.id, { day_id: e.day_id });
}

// ---------------------------------------------------------------------------
// Phase 1: Build POI candidates grouped by (type, normalizedName)
// ---------------------------------------------------------------------------
console.log('Building POI candidates...');

/**
 * Each candidate: {
 *   type: 'hotel' | 'restaurant' | 'shopping',
 *   name: string (original, best version),
 *   normalizedName: string,
 *   category: string | null,
 *   hours: string | null,
 *   description: string | null,
 *   rating: number | null,
 *   maps: string | null,
 *   mapcode: string | null,
 *   location_json: string | null,
 *   meta_json: object,
 *   source: string | null,
 *   originals: [ { ...original row data, _context } ]
 * }
 */
const poiGroups = new Map(); // key: `${type}::${normalizedName}` → candidate

function getGroupKey(type, name) {
  return `${type}::${normalizeName(name)}`;
}

// --- Hotels ---
for (const h of hotels) {
  const key = getGroupKey('hotel', h.name);
  const dayInfo = dayMap.get(h.day_id);
  if (!dayInfo) {
    console.warn(`  Warning: hotel id=${h.id} has unknown day_id=${h.day_id}, skipping`);
    continue;
  }

  // Parse breakfast JSON if it's a string
  let breakfast = null;
  if (h.breakfast) {
    try { breakfast = typeof h.breakfast === 'string' ? JSON.parse(h.breakfast) : h.breakfast; } catch { breakfast = null; }
  }

  // Parse parking_json if it's a string
  let parking = null;
  if (h.parking_json) {
    try { parking = typeof h.parking_json === 'string' ? JSON.parse(h.parking_json) : h.parking_json; } catch { parking = null; }
  }

  // Parse location_json
  let location = null;
  if (h.location_json) {
    try { location = typeof h.location_json === 'string' ? JSON.parse(h.location_json) : h.location_json; } catch { location = null; }
  }

  const meta = {
    checkout: h.checkout || null,
    breakfast: breakfast,
    parking: parking,
    booking_source: h.source === 'ai' ? null : h.source,
  };

  const original = {
    _source_table: 'hotels',
    _source_id: h.id,
    _context: 'hotel',
    _trip_id: dayInfo.trip_id,
    _day_id: h.day_id,
    _entry_id: null,
    _sort_order: null,
    name: h.name,
    description: h.details || null,
    note: h.note || null,
    meta,
    location,
  };

  if (!poiGroups.has(key)) {
    poiGroups.set(key, {
      type: 'hotel',
      name: h.name,
      normalizedName: normalizeName(h.name),
      category: null,
      hours: null,
      description: h.details || null,
      rating: null,
      maps: null,
      mapcode: null,
      location_json: h.location_json || null,
      meta_json: meta,
      source: h.source || null,
      originals: [original],
    });
  } else {
    const group = poiGroups.get(key);
    // Merge: prefer most complete
    group.name = pickBest(group.name, h.name);
    group.description = pickBest(group.description, h.details);
    group.location_json = pickBest(group.location_json, h.location_json);
    group.source = pickBest(group.source, h.source);
    // Merge meta fields
    group.meta_json.checkout = pickBest(group.meta_json.checkout, meta.checkout);
    group.meta_json.breakfast = pickBest(group.meta_json.breakfast, meta.breakfast);
    group.meta_json.parking = pickBest(group.meta_json.parking, meta.parking);
    group.meta_json.booking_source = pickBest(group.meta_json.booking_source, meta.booking_source);
    group.originals.push(original);
  }
}

// --- Restaurants ---
for (const r of restaurants) {
  const key = getGroupKey('restaurant', r.name);
  const entryInfo = entryMap.get(r.entry_id);
  if (!entryInfo) {
    console.warn(`  Warning: restaurant id=${r.id} has unknown entry_id=${r.entry_id}, skipping`);
    continue;
  }
  const dayInfo = dayMap.get(entryInfo.day_id);
  if (!dayInfo) {
    console.warn(`  Warning: restaurant id=${r.id} entry_id=${r.entry_id} has unknown day_id=${entryInfo.day_id}, skipping`);
    continue;
  }

  const meta = {
    price: r.price || null,
    reservation: r.reservation || null,
    reservation_url: r.reservation_url || null,
  };

  const original = {
    _source_table: 'restaurants',
    _source_id: r.id,
    _context: 'timeline',
    _trip_id: dayInfo.trip_id,
    _day_id: entryInfo.day_id,
    _entry_id: r.entry_id,
    _sort_order: r.sort_order,
    name: r.name,
    description: r.description || null,
    note: r.note || null,
    meta,
    location: null,
  };

  if (!poiGroups.has(key)) {
    poiGroups.set(key, {
      type: 'restaurant',
      name: r.name,
      normalizedName: normalizeName(r.name),
      category: r.category || null,
      hours: r.hours || null,
      description: r.description || null,
      rating: r.rating ?? null,
      maps: r.maps || null,
      mapcode: r.mapcode || null,
      location_json: null,
      meta_json: meta,
      source: r.source || null,
      originals: [original],
    });
  } else {
    const group = poiGroups.get(key);
    group.name = pickBest(group.name, r.name);
    group.category = pickBest(group.category, r.category);
    group.hours = pickBest(group.hours, r.hours);
    group.description = pickBest(group.description, r.description);
    group.rating = pickBest(group.rating, r.rating);
    group.maps = pickBest(group.maps, r.maps);
    group.mapcode = pickBest(group.mapcode, r.mapcode);
    group.source = pickBest(group.source, r.source);
    group.meta_json.price = pickBest(group.meta_json.price, meta.price);
    group.meta_json.reservation = pickBest(group.meta_json.reservation, meta.reservation);
    group.meta_json.reservation_url = pickBest(group.meta_json.reservation_url, meta.reservation_url);
    group.originals.push(original);
  }
}

// --- Shopping ---
for (const s of shopping) {
  const key = getGroupKey('shopping', s.name);

  // Shopping can be parented to entry or hotel (parent_type: 'entry' | 'hotel')
  let tripId = null;
  let dayId = null;
  let entryId = null;

  if (s.parent_type === 'entry') {
    const entryInfo = entryMap.get(s.parent_id);
    if (!entryInfo) {
      console.warn(`  Warning: shopping id=${s.id} has unknown entry parent_id=${s.parent_id}, skipping`);
      continue;
    }
    const dayInfo = dayMap.get(entryInfo.day_id);
    if (!dayInfo) {
      console.warn(`  Warning: shopping id=${s.id} parent entry day_id=${entryInfo.day_id} unknown, skipping`);
      continue;
    }
    tripId = dayInfo.trip_id;
    dayId = entryInfo.day_id;
    entryId = s.parent_id;
  } else if (s.parent_type === 'hotel') {
    // Hotel-parented shopping: find hotel's day → trip
    // parent_id references hotels.id; we need to find the hotel's day_id
    const parentHotel = hotels.find(h => h.id === s.parent_id);
    if (!parentHotel) {
      console.warn(`  Warning: shopping id=${s.id} has unknown hotel parent_id=${s.parent_id}, skipping`);
      continue;
    }
    const dayInfo = dayMap.get(parentHotel.day_id);
    if (!dayInfo) {
      console.warn(`  Warning: shopping id=${s.id} hotel parent day_id=${parentHotel.day_id} unknown, skipping`);
      continue;
    }
    tripId = dayInfo.trip_id;
    dayId = parentHotel.day_id;
    entryId = null;
  } else {
    console.warn(`  Warning: shopping id=${s.id} has unknown parent_type=${s.parent_type}, skipping`);
    continue;
  }

  const meta = {
    must_buy: s.must_buy || null,
  };

  const original = {
    _source_table: 'shopping',
    _source_id: s.id,
    _context: 'shopping',
    _trip_id: tripId,
    _day_id: dayId,
    _entry_id: entryId,
    _sort_order: s.sort_order,
    name: s.name,
    description: null,
    note: s.note || null,
    meta,
    location: null,
  };

  if (!poiGroups.has(key)) {
    poiGroups.set(key, {
      type: 'shopping',
      name: s.name,
      normalizedName: normalizeName(s.name),
      category: s.category || null,
      hours: s.hours || null,
      description: null,
      rating: s.rating ?? null,
      maps: s.maps || null,
      mapcode: s.mapcode || null,
      location_json: null,
      meta_json: meta,
      source: s.source || null,
      originals: [original],
    });
  } else {
    const group = poiGroups.get(key);
    group.name = pickBest(group.name, s.name);
    group.category = pickBest(group.category, s.category);
    group.hours = pickBest(group.hours, s.hours);
    group.rating = pickBest(group.rating, s.rating);
    group.maps = pickBest(group.maps, s.maps);
    group.mapcode = pickBest(group.mapcode, s.mapcode);
    group.source = pickBest(group.source, s.source);
    group.meta_json.must_buy = pickBest(group.meta_json.must_buy, meta.must_buy);
    group.originals.push(original);
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Generate SQL statements
// ---------------------------------------------------------------------------
console.log('Generating SQL...');

const totalOriginals = hotels.length + restaurants.length + shopping.length;
const totalPois = poiGroups.size;
const totalDuplicatesMerged = totalOriginals - totalPois;

const poiInserts = [];
const tripPoiInserts = [];

let tripPoiCount = 0;

for (const [, group] of poiGroups) {
  const poiId = uuid();

  // Build meta_json — remove null-valued keys for cleanliness
  const metaClean = {};
  for (const [k, v] of Object.entries(group.meta_json)) {
    if (v !== null && v !== undefined) {
      metaClean[k] = v;
    }
  }
  const metaJsonStr = Object.keys(metaClean).length > 0 ? JSON.stringify(metaClean) : null;

  // Parse location_json to extract lat/lng for the POI master
  let lat = null;
  let lng = null;
  if (group.location_json) {
    try {
      const locs = typeof group.location_json === 'string'
        ? JSON.parse(group.location_json)
        : group.location_json;
      if (Array.isArray(locs) && locs.length > 0) {
        lat = locs[0].lat ?? null;
        lng = locs[0].lng ?? null;
      }
    } catch { /* ignore parse errors */ }
  }

  poiInserts.push(
    `INSERT INTO pois (id, type, name, category, hours, description, rating, maps, mapcode, lat, lng, meta_json, source) VALUES (` +
    `${sqlStr(poiId)}, ${sqlStr(group.type)}, ${sqlStr(group.name)}, ${sqlStr(group.category)}, ` +
    `${sqlStr(group.hours)}, ${sqlStr(group.description)}, ${sqlNum(group.rating)}, ` +
    `${sqlStr(group.maps)}, ${sqlStr(group.mapcode)}, ${sqlNum(lat)}, ${sqlNum(lng)}, ` +
    `${sqlStr(metaJsonStr)}, ${sqlStr(group.source)});`
  );

  // For each original record, create a trip_pois row
  for (const orig of group.originals) {
    tripPoiCount++;

    // Compute description override: only set if different from master
    const descOverride = (orig.description && orig.description !== group.description)
      ? orig.description
      : null;

    // Compute note override (always per-trip, so include if non-empty)
    const noteOverride = orig.note || null;

    // Compute meta override: fields that differ from master
    const metaOverride = {};
    if (orig.meta) {
      for (const [k, v] of Object.entries(orig.meta)) {
        if (v === null || v === undefined) continue;
        const masterVal = group.meta_json[k];
        // Compare JSON-serialized for objects
        const vStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
        const mStr = masterVal && typeof masterVal === 'object' ? JSON.stringify(masterVal) : String(masterVal ?? '');
        if (vStr !== mStr) {
          metaOverride[k] = v;
        }
      }
    }
    const metaOverrideStr = Object.keys(metaOverride).length > 0 ? JSON.stringify(metaOverride) : null;

    tripPoiInserts.push(
      `INSERT INTO trip_pois (poi_id, trip_id, context, day_id, entry_id, sort_order, description, note, meta_json) VALUES (` +
      `${sqlStr(poiId)}, ${sqlStr(orig._trip_id)}, ${sqlStr(orig._context)}, ` +
      `${sqlNum(orig._day_id)}, ${sqlNum(orig._entry_id)}, ${sqlNum(orig._sort_order)}, ` +
      `${sqlStr(descOverride)}, ${sqlStr(noteOverride)}, ${sqlStr(metaOverrideStr)});`
    );
  }
}

// Rename old tables
const renameStatements = [
  `ALTER TABLE hotels RENAME TO hotels_legacy;`,
  `ALTER TABLE restaurants RENAME TO restaurants_legacy;`,
  `ALTER TABLE shopping RENAME TO shopping_legacy;`,
];

// ---------------------------------------------------------------------------
// Phase 3: Execute
// ---------------------------------------------------------------------------
console.log('');
console.log('=== Migration Summary ===');
console.log(`  POIs to create:       ${totalPois}`);
console.log(`  trip_pois to create:  ${tripPoiCount}`);
console.log(`  Duplicates merged:    ${totalDuplicatesMerged}`);
console.log(`  Tables to rename:     hotels → hotels_legacy, restaurants → restaurants_legacy, shopping → shopping_legacy`);
console.log('');

if (DRY_RUN) {
  console.log('[DRY-RUN MODE] No changes will be written to D1.\n');
}

// Show dedup details
console.log('--- Dedup details ---');
for (const [key, group] of poiGroups) {
  if (group.originals.length > 1) {
    const trips = [...new Set(group.originals.map(o => o._trip_id))];
    console.log(`  "${group.name}" (${group.type}): ${group.originals.length} records → 1 POI (trips: ${trips.join(', ')})`);
  }
}
console.log('');

// Execute in order: pois first, then trip_pois, then renames
console.log('Step 1/3: Inserting POIs...');
d1ExecBatch(poiInserts);
console.log(`  ${DRY_RUN ? 'Would insert' : 'Inserted'} ${poiInserts.length} POIs`);

console.log('Step 2/3: Inserting trip_pois...');
d1ExecBatch(tripPoiInserts);
console.log(`  ${DRY_RUN ? 'Would insert' : 'Inserted'} ${tripPoiInserts.length} trip_pois`);

console.log('Step 3/3: Renaming old tables...');
d1ExecBatch(renameStatements);
console.log(`  ${DRY_RUN ? 'Would rename' : 'Renamed'} hotels, restaurants, shopping → *_legacy`);

console.log('');
console.log('=== Done! ===');
console.log(`  ${totalPois} pois created, ${tripPoiCount} trip_pois created, ${totalDuplicatesMerged} duplicates merged`);
if (DRY_RUN) {
  console.log('  (dry-run: nothing was actually written)');
}
