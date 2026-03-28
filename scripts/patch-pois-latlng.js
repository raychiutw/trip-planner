#!/usr/bin/env node
/**
 * patch-pois-latlng.js — Backfill pois.lat/lng + maps from trip_entries.location
 *
 * trip_entries.location contains JSON like:
 *   [{"name":"...","googleQuery":"...","lat":26.19,"lng":127.64}]
 *
 * For each trip_poi, find the associated trip_entry, extract lat/lng,
 * and UPDATE the pois master record.
 *
 * Also extracts address/phone/email from hotel descriptions.
 *
 * Usage: node scripts/patch-pois-latlng.js [--dry-run] [--local]
 */

const { execSync } = require('child_process');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LOCAL = args.includes('--local');
const DB_NAME = 'trip-planner-db';
const ENV_FLAG = LOCAL ? '--local' : '--remote';

function d1Query(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute ${DB_NAME} ${ENV_FLAG} --json --command "${escaped}"`;
  const raw = execSync(cmd, { encoding: 'utf8', timeout: 60000 });
  const j = JSON.parse(raw.slice(raw.indexOf('[')));
  return j[0]?.results || [];
}

function d1Exec(sql) {
  if (DRY_RUN) { console.log(`  [DRY] ${sql.slice(0, 120)}`); return; }
  const escaped = sql.replace(/"/g, '\\"');
  execSync(`npx wrangler d1 execute ${DB_NAME} ${ENV_FLAG} --command "${escaped}"`, { encoding: 'utf8', timeout: 60000 });
}

function sqlStr(v) { return v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`; }
function sqlNum(v) { return v == null ? 'NULL' : String(v); }

console.log(`patch-pois-latlng.js  dry-run=${DRY_RUN}  target=${LOCAL ? 'local' : 'remote'}\n`);

// Step 1: Get all trip_pois with their entry_id
const tripPois = d1Query('SELECT tp.poi_id, tp.entry_id FROM trip_pois tp WHERE tp.entry_id IS NOT NULL GROUP BY tp.poi_id, tp.entry_id');
console.log(`trip_pois with entry_id: ${tripPois.length}`);

// Step 2: Get all entries with location
const entries = d1Query("SELECT id, location, maps, mapcode FROM trip_entries WHERE location IS NOT NULL AND location != ''");
console.log(`entries with location: ${entries.length}`);

// Build entry lookup
const entryMap = new Map();
for (const e of entries) {
  let loc = null;
  try {
    const parsed = typeof e.location === 'string' ? JSON.parse(e.location) : e.location;
    if (Array.isArray(parsed) && parsed.length > 0) loc = parsed[0];
    else if (parsed && typeof parsed === 'object') loc = parsed;
  } catch {}
  entryMap.set(e.id, { lat: loc?.lat, lng: loc?.lng, maps: e.maps, mapcode: e.mapcode });
}

// Step 3: Get current pois state
const pois = d1Query('SELECT id, lat, lng, maps, mapcode, description, type FROM pois');
const poisMap = new Map();
for (const p of pois) poisMap.set(p.id, p);

// Step 4: Build UPDATE statements
let updates = 0;
const statements = [];

for (const tp of tripPois) {
  const poi = poisMap.get(tp.poi_id);
  if (!poi) continue;

  const entry = entryMap.get(tp.entry_id);
  if (!entry) continue;

  const changes = [];

  // Backfill lat/lng
  if (poi.lat == null && entry.lat != null) changes.push(`lat = ${sqlNum(entry.lat)}`);
  if (poi.lng == null && entry.lng != null) changes.push(`lng = ${sqlNum(entry.lng)}`);

  // Backfill maps/mapcode
  if (!poi.maps && entry.maps) changes.push(`maps = ${sqlStr(entry.maps)}`);
  if (!poi.mapcode && entry.mapcode) changes.push(`mapcode = ${sqlStr(entry.mapcode)}`);

  if (changes.length > 0) {
    statements.push(`UPDATE pois SET ${changes.join(', ')} WHERE id = ${poi.id};`);
    updates++;
  }
}

// Step 5: Extract address/phone/email from hotel descriptions
for (const [, poi] of poisMap) {
  if (poi.type !== 'hotel' || !poi.description) continue;
  const desc = poi.description;
  const changes = [];

  // Extract 〒 address
  const addrMatch = desc.match(/〒[\d-]+\s*[^\n,]+/);
  if (addrMatch) changes.push(`address = ${sqlStr(addrMatch[0].trim())}`);

  // Extract TEL
  const telMatch = desc.match(/TEL[：:]\s*([\d-]+)/i);
  if (telMatch) changes.push(`phone = ${sqlStr(telMatch[1])}`);

  // Extract Email
  const emailMatch = desc.match(/Email[：:]\s*([\w.+-]+@[\w.-]+)/i);
  if (emailMatch) changes.push(`email = ${sqlStr(emailMatch[1])}`);

  if (changes.length > 0) {
    statements.push(`UPDATE pois SET ${changes.join(', ')} WHERE id = ${poi.id};`);
    updates++;
  }
}

console.log(`\nUpdates to apply: ${updates}`);

if (statements.length === 0) {
  console.log('Nothing to update.');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('\n[DRY-RUN] Sample statements:');
  for (const s of statements.slice(0, 10)) console.log(`  ${s.slice(0, 150)}`);
  if (statements.length > 10) console.log(`  ... and ${statements.length - 10} more`);
  process.exit(0);
}

// Execute in batches of 50
const BATCH = 50;
for (let i = 0; i < statements.length; i += BATCH) {
  const batch = statements.slice(i, i + BATCH);
  const sql = batch.join('\n');
  const tmpFile = require('path').join(__dirname, `_patch_latlng_${Date.now()}.sql`);
  require('fs').writeFileSync(tmpFile, sql);
  try {
    execSync(`npx wrangler d1 execute ${DB_NAME} ${ENV_FLAG} --file "${tmpFile}"`, { encoding: 'utf8', timeout: 60000 });
  } finally {
    require('fs').unlinkSync(tmpFile);
  }
  console.log(`  Batch ${Math.floor(i/BATCH)+1}/${Math.ceil(statements.length/BATCH)}: ${batch.length} updates`);
}

// Verify
const after = d1Query('SELECT COUNT(*) as total, SUM(CASE WHEN lat IS NOT NULL THEN 1 ELSE 0 END) as has_lat, SUM(CASE WHEN address IS NOT NULL THEN 1 ELSE 0 END) as has_addr, SUM(CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) as has_phone FROM pois');
console.log('\n=== After ===');
console.log(JSON.stringify(after[0], null, 2));
