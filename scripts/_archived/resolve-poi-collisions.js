#!/usr/bin/env node
/**
 * resolve-poi-collisions.js — 解決 (name, type) 碰撞 entries 的 POI 歸屬
 *
 * 背景：migrate-entries-to-pois.js --force 會把所有同名 entries 合併到同一筆 pois，
 * 其他 entry 的原始座標只保留在 trip_entries.location（Phase 3 DROP 前仍在）。
 *
 * 本腳本：
 *   1. 找出指向「collision POI」的 entries（同 pois 被多個 entry 用且原 entry.location 座標不同）
 *   2. 為每個 collision entry 建獨立的 pois 列（名稱 = `{title} #{entry.id}`，保原始座標）
 *   3. UPDATE trip_entries.poi_id 指向新 POI
 *
 * 必須在 migration 0027（DROP location 欄）之前跑，否則拿不到原始座標。
 *
 * Usage:
 *   node scripts/resolve-poi-collisions.js --dry-run
 *   node scripts/resolve-poi-collisions.js --apply
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_NAME = 'trip-planner-db';
const REPORT_DIR = path.join(__dirname, '..', '.gstack', 'migration-reports');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const APPLY = args.includes('--apply');

if (!DRY_RUN && !APPLY) {
  console.error('必須指定 --dry-run 或 --apply');
  process.exit(1);
}

function runD1Query(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  const raw = execSync(
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command "${escaped}"`,
    { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const jsonStart = raw.indexOf('[');
  if (jsonStart < 0) return [];
  return JSON.parse(raw.slice(jsonStart))[0]?.results ?? [];
}

function runD1File(sqlFile) {
  execSync(
    `npx wrangler d1 execute ${DB_NAME} --remote --file "${sqlFile}"`,
    { encoding: 'utf8', timeout: 180000, stdio: 'inherit' },
  );
}

function sqlString(v) {
  if (v == null) return 'NULL';
  if (typeof v === 'number') return isFinite(v) ? String(v) : 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function parseLocation(loc) {
  if (loc == null) return null;
  if (typeof loc !== 'string') return loc;
  try {
    const parsed = JSON.parse(loc);
    return Array.isArray(parsed) ? parsed[0] ?? null : parsed;
  } catch {
    return null;
  }
}

console.log(`resolve-poi-collisions.js — ${DRY_RUN ? 'dry-run' : 'APPLY'}\n`);

// Step 1: 找出 collision POIs — 同 pois 被多個 entry 引用
const collisionPoisSql = `
  SELECT p.id AS poi_id, p.name, p.type, COUNT(e.id) AS entry_count
  FROM pois p
  JOIN trip_entries e ON e.poi_id = p.id
  GROUP BY p.id
  HAVING COUNT(e.id) > 1
  ORDER BY entry_count DESC
`.replace(/\s+/g, ' ').trim();

const collisionPois = runD1Query(collisionPoisSql);
console.log(`找到 ${collisionPois.length} 個被多 entry 引用的 POI`);

if (collisionPois.length === 0) {
  console.log('✅ 沒有 collision 需要解');
  process.exit(0);
}

// Step 2: 對每個 collision POI，撈它底下所有 entries 的原始 location
const collisionEntries = [];
for (const p of collisionPois) {
  const entriesSql = `
    SELECT e.id, e.title, e.location, d.trip_id, d.day_num
    FROM trip_entries e
    JOIN trip_days d ON e.day_id = d.id
    WHERE e.poi_id = ${p.poi_id}
    ORDER BY d.trip_id, d.day_num, e.sort_order
  `.replace(/\s+/g, ' ').trim();
  const entries = runD1Query(entriesSql);

  // 檢查座標是否真的碰撞
  const entriesWithCoords = entries.map((e) => {
    const loc = parseLocation(e.location);
    return { ...e, poiId: p.poi_id, poiName: p.name, poiType: p.type, origLat: loc?.lat ?? null, origLng: loc?.lng ?? null };
  });

  const withCoords = entriesWithCoords.filter((e) => e.origLat != null && e.origLng != null);
  if (withCoords.length < 2) continue;

  // 有 > 300m 差異的 entries 視為真碰撞，需要分離
  const first = withCoords[0];
  const COLLISION_THRESHOLD_DEG = 0.003;
  const hasCollision = withCoords.some((e) => {
    const d = Math.abs(e.origLat - first.origLat) + Math.abs(e.origLng - first.origLng);
    return d > COLLISION_THRESHOLD_DEG;
  });
  if (hasCollision) {
    collisionEntries.push(...entriesWithCoords);
  }
}

console.log(`\n需要分離 POI 的 entries：${collisionEntries.length} 筆`);
if (collisionEntries.length === 0) {
  console.log('✅ 所有 collision POI 內部座標一致，無需分離');
  process.exit(0);
}

// Step 3: 報告
console.log('\n明細：');
for (const e of collisionEntries) {
  console.log(`  - [${e.trip_id} D${e.day_num}] entry ${e.id} "${(e.title || '').slice(0, 30)}" → 新 POI "${e.title} #${e.id}"`);
}

if (DRY_RUN) {
  console.log('\n🔍 dry-run 完成。移除 --dry-run 改用 --apply 正式套用。');
  process.exit(0);
}

// Step 4: APPLY — INSERT 新 pois + UPDATE trip_entries.poi_id
fs.mkdirSync(REPORT_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const sqlFile = path.join(REPORT_DIR, `${ts}-resolve-collisions.sql`);
const stmts = ['-- resolve-poi-collisions — 為每個 collision entry 建獨立 pois + 重掛'];

for (const e of collisionEntries) {
  const newName = `${e.title} #${e.id}`;
  // INSERT new POI with original coords, 取 RETURNING id，然後 UPDATE entry
  stmts.push(
    `INSERT INTO pois (type, name, lat, lng, source, country) VALUES (${sqlString(e.poiType)}, ${sqlString(newName)}, ${sqlString(e.origLat)}, ${sqlString(e.origLng)}, 'ai-resolve', 'JP');`,
  );
  stmts.push(
    `UPDATE trip_entries SET poi_id = (SELECT id FROM pois WHERE name = ${sqlString(newName)} AND type = ${sqlString(e.poiType)} LIMIT 1) WHERE id = ${e.id};`,
  );
}

// 之後清掉不再被引用的 collision POI（避免 orphan）
stmts.push('-- 清理不再被引用的 collision POI');
stmts.push(`DELETE FROM pois WHERE id NOT IN (
  SELECT DISTINCT poi_id FROM trip_pois
  UNION SELECT DISTINCT poi_id FROM trip_entries WHERE poi_id IS NOT NULL
  UNION SELECT DISTINCT poi_id FROM poi_relations
  UNION SELECT DISTINCT related_poi_id FROM poi_relations
);`);

fs.writeFileSync(sqlFile, stmts.join('\n'));
console.log(`\nSQL 檔：${sqlFile}`);
console.log('套用中...\n');
runD1File(sqlFile);

console.log('\n✅ 碰撞解完。建議再跑 verify：node scripts/verify-entry-poi-backfill.js');
