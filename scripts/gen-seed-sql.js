#!/usr/bin/env node
/**
 * 從 backup JSON 生成 seed SQL 檔案。
 * 用法：node scripts/gen-seed-sql.js [backup-dir]
 * 預設：backups/ 下最新的目錄
 * 輸出：migrations/seed.sql
 *
 * 生成的 SQL 使用重構後的表名/欄位名（0014_poi_normalization 之後）。
 */

const fs = require('fs');
const path = require('path');

const backupDir = process.argv[2] || (() => {
  const dirs = fs.readdirSync('backups').filter(d => fs.statSync(`backups/${d}`).isDirectory()).sort();
  return `backups/${dirs[dirs.length - 1]}`;
})();

console.log(`Reading from: ${backupDir}`);

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function jsonEsc(v) {
  if (v === null || v === undefined) return 'NULL';
  return esc(typeof v === 'string' ? v : JSON.stringify(v));
}

const lines = [];
lines.push('-- Auto-generated seed data from backup');
lines.push('-- Schema: post-0014_poi_normalization (new table/column names)');
lines.push('-- Usage: npx wrangler d1 execute trip-planner-db-staging --remote --file migrations/seed.sql');
lines.push('');

// --- trips ---
const trips = JSON.parse(fs.readFileSync(`${backupDir}/trips.json`, 'utf8'));
lines.push('-- trips');
for (const t of trips) {
  lines.push(`INSERT OR IGNORE INTO trips (id,name,owner,title,self_drive,countries,published,auto_scroll,footer,is_default) VALUES (${esc(t.id)},${esc(t.name)},${esc(t.owner)},${esc(t.title)},${t.self_drive||0},${esc(t.countries||'JP')},${t.published||1},${esc(t.auto_scroll)},${jsonEsc(t.footer_json)},${t.is_default||0});`);
}
lines.push('');

// --- trip_days (was: days) ---
const days = JSON.parse(fs.readFileSync(`${backupDir}/days.json`, 'utf8'));
lines.push('-- trip_days (was: days) — weather_json dropped');
for (const d of days) {
  lines.push(`INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (${d.id},${esc(d.trip_id)},${d.day_num},${esc(d.date)},${esc(d.day_of_week)},${esc(d.label)});`);
}
lines.push('');

// --- hotels (still hotels until migrate-pois runs) ---
const hotels = JSON.parse(fs.readFileSync(`${backupDir}/hotels.json`, 'utf8'));
lines.push('-- hotels (pre-POI migration — will become hotels_legacy after migrate-pois.js)');
for (const h of hotels) {
  lines.push(`INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (${h.id},${h.day_id},${esc(h.name)},${esc(h.checkout)},${esc(h.source||'ai')},${esc(h.details)},${jsonEsc(h.breakfast)},${esc(h.note)},${jsonEsc(h.parking_json)});`);
}
lines.push('');

// --- trip_entries (was: entries) ---
const entries = JSON.parse(fs.readFileSync(`${backupDir}/entries.json`, 'utf8'));
lines.push('-- trip_entries (was: entries) — body→description, rating→google_rating, location_json→location');
for (const e of entries) {
  lines.push(`INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (${e.id},${e.day_id},${e.sort_order},${esc(e.time)},${esc(e.title)},${esc(e.body)},${esc(e.source||'ai')},${esc(e.maps)},${esc(e.mapcode)},${e.rating !== null && e.rating !== undefined ? e.rating : 'NULL'},${esc(e.note)},${esc(e.travel_type)},${esc(e.travel_desc)},${e.travel_min !== null && e.travel_min !== undefined ? e.travel_min : 'NULL'},${jsonEsc(e.location_json)});`);
}
lines.push('');

// --- restaurants ---
const restaurants = JSON.parse(fs.readFileSync(`${backupDir}/restaurants.json`, 'utf8'));
lines.push('-- restaurants (pre-POI migration)');
for (const r of restaurants) {
  lines.push(`INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (${r.id},${r.entry_id},${r.sort_order||0},${esc(r.name)},${esc(r.category)},${esc(r.hours)},${esc(r.price)},${esc(r.reservation)},${esc(r.reservation_url)},${esc(r.description)},${esc(r.note)},${r.rating !== null && r.rating !== undefined ? r.rating : 'NULL'},${esc(r.maps)},${esc(r.mapcode)},${esc(r.source||'ai')});`);
}
lines.push('');

// --- shopping ---
const shopping = JSON.parse(fs.readFileSync(`${backupDir}/shopping.json`, 'utf8'));
lines.push('-- shopping (pre-POI migration)');
for (const s of shopping) {
  lines.push(`INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (${s.id},${esc(s.parent_type)},${s.parent_id},${s.sort_order||0},${esc(s.name)},${esc(s.category)},${esc(s.hours)},${esc(s.must_buy)},${esc(s.note)},${s.rating !== null && s.rating !== undefined ? s.rating : 'NULL'},${esc(s.maps)},${esc(s.mapcode)},${esc(s.source||'ai')});`);
}
lines.push('');

// --- trip_docs (legacy) ---
const docs = JSON.parse(fs.readFileSync(`${backupDir}/trip_docs.json`, 'utf8'));
lines.push('-- trip_docs');
for (const d of docs) {
  lines.push(`INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (${d.id},${esc(d.trip_id)},${esc(d.doc_type)},${esc(d.content)});`);
}
lines.push('');

// --- trip_docs_v2 ---
const docsV2Path = `${backupDir}/trip_docs_v2.json`;
if (fs.existsSync(docsV2Path)) {
  const docsV2 = JSON.parse(fs.readFileSync(docsV2Path, 'utf8'));
  lines.push('-- trip_docs_v2');
  for (const d of docsV2) {
    lines.push(`INSERT OR IGNORE INTO trip_docs_v2 (id,trip_id,doc_type,title,updated_at) VALUES (${d.id},${esc(d.trip_id)},${esc(d.doc_type)},${esc(d.title)},${esc(d.updated_at)});`);
  }
  lines.push('');
}

// --- trip_doc_entries ---
const docEntriesPath = `${backupDir}/trip_doc_entries.json`;
if (fs.existsSync(docEntriesPath)) {
  const docEntries = JSON.parse(fs.readFileSync(docEntriesPath, 'utf8'));
  lines.push('-- trip_doc_entries');
  for (const e of docEntries) {
    lines.push(`INSERT OR IGNORE INTO trip_doc_entries (id,doc_id,sort_order,section,title,content) VALUES (${e.id},${e.doc_id},${e.sort_order},${esc(e.section)},${esc(e.title)},${esc(e.content)});`);
  }
  lines.push('');
}


// --- trip_requests (was: requests) ---
const requests = JSON.parse(fs.readFileSync(`${backupDir}/requests.json`, 'utf8'));
lines.push('-- trip_requests (was: requests)');
for (const r of requests) {
  lines.push(`INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (${r.id},${esc(r.trip_id)},${esc(r.mode)},${esc(r.title)},${esc(r.body)},${esc(r.submitted_by)},${esc(r.reply)},${esc(r.status)},${esc(r.created_at)});`);
}
lines.push('');

// --- trip_permissions (was: permissions) ---
const perms = JSON.parse(fs.readFileSync(`${backupDir}/permissions.json`, 'utf8'));
lines.push('-- trip_permissions (was: permissions)');
for (const p of perms) {
  lines.push(`INSERT OR IGNORE INTO trip_permissions (id,email,trip_id,role) VALUES (${p.id},${esc(p.email)},${esc(p.trip_id)},${esc(p.role)});`);
}
lines.push('');

const outPath = 'migrations/seed.sql';
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Written: ${outPath} (${lines.length} lines)`);
