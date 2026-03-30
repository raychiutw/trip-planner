#!/usr/bin/env node
/**
 * migrate-pois.js — Migrate hotels/restaurants/shopping → pois + trip_pois (V2 Schema)
 *
 * V2 changes vs V1:
 * - pois: lat/lng REAL columns (no JSON), no attrs/meta_json
 * - trip_pois: flattened type-specific columns (checkout, price, must_buy, etc.)
 * - poi_relations: parking↔hotel many-to-many at master level
 * - Parking with name+location → separate pois(type='parking') + poi_relations
 *
 * Usage:
 *   node scripts/migrate-pois.js [--dry-run] [--local] [--from-backup <dir>]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

console.log('migrate-pois.js (V2 Schema)');
console.log(`  dry-run:  ${DRY_RUN}`);
console.log(`  target:   ${LOCAL ? 'local' : 'remote'}`);
console.log(`  source:   ${BACKUP_DIR ? `backup (${BACKUP_DIR})` : 'D1 live'}`);
console.log('');

// ---------------------------------------------------------------------------
// Helpers: D1 interaction
// ---------------------------------------------------------------------------

function d1Query(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute ${DB_NAME} ${ENV_FLAG} --command "${escaped}" --json`;
  const raw = execSync(cmd, { encoding: 'utf8', timeout: 60000 });
  const jsonStart = raw.indexOf('[');
  if (jsonStart === -1) throw new Error(`No JSON in wrangler output: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(raw.slice(jsonStart));
  return parsed[0]?.results || [];
}

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

function normalizeName(name) {
  if (!name) return '';
  let s = name;
  // Full-width alphanumeric → half-width
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
// Helpers: SQL escaping + merge
// ---------------------------------------------------------------------------

function pickBest(a, b) {
  if (a === null || a === undefined || a === '') return b;
  if (b === null || b === undefined || b === '') return a;
  if (typeof a === 'string' && typeof b === 'string') return a.length >= b.length ? a : b;
  return a;
}

function sqlStr(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function sqlNum(val) {
  if (val === null || val === undefined) return 'NULL';
  return String(val);
}

function parseJson(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Read source data
// ---------------------------------------------------------------------------

console.log('Reading source data...');
const hotels = readTable('hotels');
const restaurants = readTable('restaurants');
const shopping = readTable('shopping');
const days = readTable(BACKUP_DIR ? 'days' : 'trip_days');
const entries = readTable(BACKUP_DIR ? 'entries' : 'trip_entries');

console.log(`  hotels:      ${hotels.length} rows`);
console.log(`  restaurants: ${restaurants.length} rows`);
console.log(`  shopping:    ${shopping.length} rows`);
console.log(`  days:        ${days.length} rows`);
console.log(`  entries:     ${entries.length} rows`);
console.log('');

// Build lookup maps
const dayMap = new Map();
for (const d of days) dayMap.set(d.id, { trip_id: d.trip_id, day_num: d.day_num });

const entryMap = new Map();
for (const e of entries) entryMap.set(e.id, { day_id: e.day_id });

// ---------------------------------------------------------------------------
// Phase 1: Build POI groups by (type, normalizedName, maps)
// Dedup key: (type, normalizedName, maps) — 審查 E5
// ---------------------------------------------------------------------------

console.log('Building POI candidates...');

const poiGroups = new Map();

function getGroupKey(type, name, maps) {
  const normName = normalizeName(name);
  // Include maps URL in key to distinguish same-name different-location POIs
  const mapsKey = maps ? maps.replace(/https?:\/\//g, '').toLowerCase() : '';
  return `${type}::${normName}::${mapsKey}`;
}

// --- Hotels ---
for (const h of hotels) {
  const key = getGroupKey('hotel', h.name, h.maps);
  const dayInfo = dayMap.get(h.day_id);
  if (!dayInfo) { console.warn(`  Skip hotel id=${h.id}: unknown day_id=${h.day_id}`); continue; }

  const breakfast = parseJson(h.breakfast);
  const parking = parseJson(BACKUP_DIR ? h.parking_json : h.parking);
  const location = parseJson(BACKUP_DIR ? h.location_json : h.location);

  const original = {
    _table: 'hotels', _id: h.id, _context: 'hotel',
    _trip_id: dayInfo.trip_id, _day_id: h.day_id, _entry_id: null, _sort_order: null,
    name: h.name,
    description: (BACKUP_DIR ? h.details : h.description) || null,
    note: h.note || null,
    checkout: h.checkout || null,
    breakfast_included: breakfast?.included != null ? (breakfast.included ? 1 : 0) : null,
    breakfast_note: breakfast?.note || null,
    parking, location,
    google_rating: null, maps: h.maps || null, mapcode: h.mapcode || null,
    category: null, hours: null, source: h.source || null,
  };

  if (!poiGroups.has(key)) {
    const lat = location && Array.isArray(location) ? location[0]?.lat : location?.lat;
    const lng = location && Array.isArray(location) ? location[0]?.lng : location?.lng;
    poiGroups.set(key, {
      type: 'hotel', name: h.name, normalizedName: normalizeName(h.name),
      description: original.description, note: null,
      category: null, hours: null, google_rating: null,
      maps: h.maps || null, mapcode: h.mapcode || null,
      lat: lat ?? null, lng: lng ?? null,
      source: h.source || null, originals: [original],
    });
  } else {
    const g = poiGroups.get(key);
    g.name = pickBest(g.name, h.name);
    g.description = pickBest(g.description, original.description);
    g.source = pickBest(g.source, h.source);
    g.originals.push(original);
  }
}

// --- Restaurants ---
for (const r of restaurants) {
  const key = getGroupKey('restaurant', r.name, r.maps);
  const entryInfo = entryMap.get(r.entry_id);
  if (!entryInfo) { console.warn(`  Skip restaurant id=${r.id}: unknown entry_id=${r.entry_id}`); continue; }
  const dayInfo = dayMap.get(entryInfo.day_id);
  if (!dayInfo) { console.warn(`  Skip restaurant id=${r.id}: unknown day_id=${entryInfo.day_id}`); continue; }

  const original = {
    _table: 'restaurants', _id: r.id, _context: 'timeline',
    _trip_id: dayInfo.trip_id, _day_id: entryInfo.day_id, _entry_id: r.entry_id, _sort_order: r.sort_order,
    name: r.name,
    description: r.description || null, note: r.note || null,
    price: r.price || null, reservation: r.reservation || null,
    reservation_url: r.reservation_url || null,
    google_rating: (BACKUP_DIR ? r.rating : r.google_rating) ?? null,
    maps: r.maps || null, mapcode: r.mapcode || null,
    category: r.category || null, hours: r.hours || null, source: r.source || null,
  };

  if (!poiGroups.has(key)) {
    poiGroups.set(key, {
      type: 'restaurant', name: r.name, normalizedName: normalizeName(r.name),
      description: original.description, note: null,
      category: r.category || null, hours: r.hours || null,
      google_rating: original.google_rating,
      maps: r.maps || null, mapcode: r.mapcode || null,
      lat: null, lng: null,
      source: r.source || null, originals: [original],
    });
  } else {
    const g = poiGroups.get(key);
    g.name = pickBest(g.name, r.name);
    g.category = pickBest(g.category, r.category);
    g.hours = pickBest(g.hours, r.hours);
    g.description = pickBest(g.description, original.description);
    g.google_rating = pickBest(g.google_rating, original.google_rating);
    g.maps = pickBest(g.maps, r.maps);
    g.mapcode = pickBest(g.mapcode, r.mapcode);
    g.originals.push(original);
  }
}

// --- Shopping ---
for (const s of shopping) {
  const key = getGroupKey('shopping', s.name, s.maps);

  let tripId = null, dayId = null, entryId = null;
  if (s.parent_type === 'entry') {
    const entryInfo = entryMap.get(s.parent_id);
    if (!entryInfo) { console.warn(`  Skip shopping id=${s.id}: unknown entry parent_id=${s.parent_id}`); continue; }
    const dayInfo = dayMap.get(entryInfo.day_id);
    if (!dayInfo) { console.warn(`  Skip shopping id=${s.id}: unknown day_id`); continue; }
    tripId = dayInfo.trip_id; dayId = entryInfo.day_id; entryId = s.parent_id;
  } else if (s.parent_type === 'hotel') {
    const parentHotel = hotels.find(h => h.id === s.parent_id);
    if (!parentHotel) { console.warn(`  Skip shopping id=${s.id}: unknown hotel parent_id=${s.parent_id}`); continue; }
    const dayInfo = dayMap.get(parentHotel.day_id);
    if (!dayInfo) { console.warn(`  Skip shopping id=${s.id}: unknown day_id`); continue; }
    tripId = dayInfo.trip_id; dayId = parentHotel.day_id;
  } else { console.warn(`  Skip shopping id=${s.id}: unknown parent_type=${s.parent_type}`); continue; }

  const original = {
    _table: 'shopping', _id: s.id, _context: 'shopping',
    _trip_id: tripId, _day_id: dayId, _entry_id: entryId, _sort_order: s.sort_order,
    name: s.name, description: null, note: s.note || null,
    must_buy: s.must_buy || null,
    google_rating: (BACKUP_DIR ? s.rating : s.google_rating) ?? null,
    maps: s.maps || null, mapcode: s.mapcode || null,
    category: s.category || null, hours: s.hours || null, source: s.source || null,
  };

  if (!poiGroups.has(key)) {
    poiGroups.set(key, {
      type: 'shopping', name: s.name, normalizedName: normalizeName(s.name),
      description: null, note: null,
      category: s.category || null, hours: s.hours || null,
      google_rating: original.google_rating,
      maps: s.maps || null, mapcode: s.mapcode || null,
      lat: null, lng: null,
      source: s.source || null, originals: [original],
    });
  } else {
    const g = poiGroups.get(key);
    g.name = pickBest(g.name, s.name);
    g.category = pickBest(g.category, s.category);
    g.hours = pickBest(g.hours, s.hours);
    g.google_rating = pickBest(g.google_rating, original.google_rating);
    g.maps = pickBest(g.maps, s.maps);
    g.mapcode = pickBest(g.mapcode, s.mapcode);
    g.originals.push(original);
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Generate SQL — pois + trip_pois + poi_relations + parking
// ---------------------------------------------------------------------------

console.log('Generating SQL...');

const poiInserts = [];
const tripPoiInserts = [];
const poiRelationInserts = [];

// Assign sequential IDs (table is empty, AUTOINCREMENT starts from 1)
let nextPoiId = 1;
const poiIdMap = new Map(); // groupKey → poiId

// First pass: create all POI groups
for (const [key, group] of poiGroups) {
  const poiId = nextPoiId++;
  poiIdMap.set(key, poiId);

  poiInserts.push(
    `INSERT INTO pois (id, type, name, description, note, hours, google_rating, category, maps, mapcode, lat, lng, source) VALUES (` +
    `${poiId}, ${sqlStr(group.type)}, ${sqlStr(group.name)}, ${sqlStr(group.description)}, ` +
    `NULL, ${sqlStr(group.hours)}, ${sqlNum(group.google_rating)}, ${sqlStr(group.category)}, ` +
    `${sqlStr(group.maps)}, ${sqlStr(group.mapcode)}, ${sqlNum(group.lat)}, ${sqlNum(group.lng)}, ${sqlStr(group.source)});`
  );
}

// Second pass: parking splitting + poi_relations
// 審查 E6: parking with name + (lat/lng or maps) → separate POI
const parkingPoiIds = new Map(); // hotelPoiId → [parkingPoiId]

for (const [key, group] of poiGroups) {
  if (group.type !== 'hotel') continue;
  const hotelPoiId = poiIdMap.get(key);

  for (const orig of group.originals) {
    if (!orig.parking) continue;
    const p = orig.parking;
    const hasName = !!p.name || !!p.info;
    const hasLocation = (p.lat && p.lng) || p.maps || p.mapcode;

    if (hasName && hasLocation) {
      // Situation A: create independent parking POI
      const parkingName = p.name || p.info || '停車場';
      const parkingKey = getGroupKey('parking', parkingName, p.maps);

      if (!poiIdMap.has(parkingKey)) {
        const parkingId = nextPoiId++;
        poiIdMap.set(parkingKey, parkingId);

        poiInserts.push(
          `INSERT INTO pois (id, type, name, description, note, maps, mapcode, lat, lng, source) VALUES (` +
          `${parkingId}, 'parking', ${sqlStr(parkingName)}, ${sqlStr(p.price ? `費用：${p.price}` : null)}, ` +
          `${sqlStr(p.note || null)}, ${sqlStr(p.maps || null)}, ${sqlStr(p.mapcode || null)}, ` +
          `${sqlNum(p.lat || null)}, ${sqlNum(p.lng || null)}, 'ai');`
        );

        // poi_relations: hotel → parking
        poiRelationInserts.push(
          `INSERT OR IGNORE INTO poi_relations (poi_id, related_poi_id, relation_type, note) VALUES (` +
          `${hotelPoiId}, ${parkingId}, 'parking', ${sqlStr(p.note || null)});`
        );
      } else {
        // Parking POI already exists (dedup), just add relation
        const existingParkingId = poiIdMap.get(parkingKey);
        poiRelationInserts.push(
          `INSERT OR IGNORE INTO poi_relations (poi_id, related_poi_id, relation_type, note) VALUES (` +
          `${hotelPoiId}, ${existingParkingId}, 'parking', ${sqlStr(p.note || null)});`
        );
      }
    }
    // Situation B: parking without name/location → will be in hotel description
    // (handled by skills when regenerating descriptions)
  }
}

// Third pass: trip_pois with flattened type-specific columns
for (const [key, group] of poiGroups) {
  const poiId = poiIdMap.get(key);

  for (const orig of group.originals) {
    // Description override: only if different from master
    const descOverride = (orig.description && orig.description !== group.description)
      ? orig.description : null;

    // Build INSERT based on context
    const baseCols = 'poi_id, trip_id, context, day_id, entry_id, sort_order, description, note, hours';
    const baseVals = `${poiId}, ${sqlStr(orig._trip_id)}, ${sqlStr(orig._context)}, ` +
      `${sqlNum(orig._day_id)}, ${sqlNum(orig._entry_id)}, ${sqlNum(orig._sort_order)}, ` +
      `${sqlStr(descOverride)}, ${sqlStr(orig.note)}, ${sqlStr(orig.hours || null)}`;

    if (group.type === 'hotel') {
      tripPoiInserts.push(
        `INSERT INTO trip_pois (${baseCols}, checkout, breakfast_included, breakfast_note) VALUES (` +
        `${baseVals}, ${sqlStr(orig.checkout)}, ${sqlNum(orig.breakfast_included)}, ${sqlStr(orig.breakfast_note)});`
      );
    } else if (group.type === 'restaurant') {
      tripPoiInserts.push(
        `INSERT INTO trip_pois (${baseCols}, price, reservation, reservation_url) VALUES (` +
        `${baseVals}, ${sqlStr(orig.price)}, ${sqlStr(orig.reservation)}, ${sqlStr(orig.reservation_url)});`
      );
    } else if (group.type === 'shopping') {
      tripPoiInserts.push(
        `INSERT INTO trip_pois (${baseCols}, must_buy) VALUES (` +
        `${baseVals}, ${sqlStr(orig.must_buy)});`
      );
    }
  }
}

// Also create trip_pois for parking POIs that were split out
for (const [key, group] of poiGroups) {
  if (group.type !== 'hotel') continue;
  for (const orig of group.originals) {
    if (!orig.parking) continue;
    const p = orig.parking;
    const hasName = !!p.name || !!p.info;
    const hasLocation = (p.lat && p.lng) || p.maps || p.mapcode;
    if (!hasName || !hasLocation) continue;

    const parkingName = p.name || p.info || '停車場';
    const parkingKey = getGroupKey('parking', parkingName, p.maps);
    const parkingPoiId = poiIdMap.get(parkingKey);
    if (!parkingPoiId) continue;

    tripPoiInserts.push(
      `INSERT INTO trip_pois (poi_id, trip_id, context, day_id, description, note) VALUES (` +
      `${parkingPoiId}, ${sqlStr(orig._trip_id)}, 'hotel', ${sqlNum(orig._day_id)}, ` +
      `${sqlStr(p.price ? `費用：${p.price}` : null)}, ${sqlStr(p.note || null)});`
    );
  }
}

// Rename old tables (last step — 審查 E8)
// Skip if already renamed (idempotent)
const renameStatements = [];
if (!DRY_RUN) {
  try {
    d1Query('SELECT 1 FROM hotels LIMIT 1');
    renameStatements.push('ALTER TABLE hotels RENAME TO hotels_legacy;');
  } catch { console.log('  hotels already renamed to _legacy, skipping'); }
  try {
    d1Query('SELECT 1 FROM restaurants LIMIT 1');
    renameStatements.push('ALTER TABLE restaurants RENAME TO restaurants_legacy;');
  } catch { console.log('  restaurants already renamed to _legacy, skipping'); }
  try {
    d1Query('SELECT 1 FROM shopping LIMIT 1');
    renameStatements.push('ALTER TABLE shopping RENAME TO shopping_legacy;');
  } catch { console.log('  shopping already renamed to _legacy, skipping'); }
}

// ---------------------------------------------------------------------------
// Phase 3: Execute with verification (審查 E8)
// ---------------------------------------------------------------------------

const totalOriginals = hotels.length + restaurants.length + shopping.length;
const totalPois = poiInserts.length;
const totalTripPois = tripPoiInserts.length;
const totalRelations = poiRelationInserts.length;
const totalDuplicatesMerged = totalOriginals - [...poiGroups.values()].reduce((sum, g) => sum + g.originals.length, 0);

console.log('');
console.log('=== Migration Summary ===');
console.log(`  Source records:      ${totalOriginals} (${hotels.length} hotels, ${restaurants.length} restaurants, ${shopping.length} shopping)`);
console.log(`  POIs to create:      ${totalPois} (${totalDuplicatesMerged < 0 ? 0 : totalDuplicatesMerged} duplicates merged)`);
console.log(`  trip_pois to create: ${totalTripPois}`);
console.log(`  poi_relations:       ${totalRelations}`);
console.log(`  Tables to rename:    hotels, restaurants, shopping → *_legacy`);
console.log('');

// Dedup details
console.log('--- Dedup details ---');
let dedupCount = 0;
for (const [, group] of poiGroups) {
  if (group.originals.length > 1) {
    dedupCount++;
    const trips = [...new Set(group.originals.map(o => o._trip_id))];
    console.log(`  "${group.name}" (${group.type}): ${group.originals.length} records → 1 POI (trips: ${trips.join(', ')})`);
  }
}
if (dedupCount === 0) console.log('  (no duplicates found)');
console.log('');

if (DRY_RUN) {
  console.log('[DRY-RUN] No changes written.\n');
  console.log('Sample POI INSERT:');
  if (poiInserts.length > 0) console.log(`  ${poiInserts[0]}`);
  console.log('Sample trip_pois INSERT:');
  if (tripPoiInserts.length > 0) console.log(`  ${tripPoiInserts[0]}`);
  if (poiRelationInserts.length > 0) {
    console.log('Sample poi_relations INSERT:');
    console.log(`  ${poiRelationInserts[0]}`);
  }
  process.exit(0);
}

// Execute in order: pois → poi_relations → trip_pois → rename
console.log('Step 1/4: Inserting POIs...');
d1ExecBatch(poiInserts);
console.log(`  Inserted ${poiInserts.length} POIs`);

console.log('Step 2/4: Inserting poi_relations...');
d1ExecBatch(poiRelationInserts);
console.log(`  Inserted ${poiRelationInserts.length} relations`);

console.log('Step 3/4: Inserting trip_pois...');
d1ExecBatch(tripPoiInserts);
console.log(`  Inserted ${tripPoiInserts.length} trip_pois`);

// Verify row counts (審查 E8)
console.log('');
console.log('--- Verification ---');
const poisCount = d1Query('SELECT COUNT(*) as cnt FROM pois')[0]?.cnt;
const tripPoisCount = d1Query('SELECT COUNT(*) as cnt FROM trip_pois')[0]?.cnt;
const relationsCount = d1Query('SELECT COUNT(*) as cnt FROM poi_relations')[0]?.cnt;
console.log(`  pois:          ${poisCount} (expected ${totalPois})`);
console.log(`  trip_pois:     ${tripPoisCount} (expected ${totalTripPois})`);
console.log(`  poi_relations: ${relationsCount} (expected ${totalRelations})`);

if (poisCount !== totalPois || tripPoisCount !== totalTripPois) {
  console.error('\n❌ Row count mismatch! NOT renaming old tables. Investigate and retry.');
  process.exit(1);
}

console.log('\nStep 4/4: Renaming old tables...');
d1ExecBatch(renameStatements);
console.log('  Renamed hotels, restaurants, shopping → *_legacy');

console.log('\n=== Done! ===');
console.log(`  ${poisCount} pois, ${tripPoisCount} trip_pois, ${relationsCount} relations`);
