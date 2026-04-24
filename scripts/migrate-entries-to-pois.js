#!/usr/bin/env node
/**
 * migrate-entries-to-pois.js — Phase 2 backfill 腳本
 *
 * 將 legacy trip_entries（無 poi_id）以 heuristic 分類成 attraction / transport / activity
 * 三種 POI type，find-or-create 進 pois master，再回填 trip_entries.poi_id。
 *
 * Heuristic（per SPEC §4）：
 *   - title 含 機場/空港/港/碼頭/站/駅/airport/station/port → transport
 *   - text 含 浮潛/潛水/玉泉洞/鳳梨園/體驗/workshop/採/摘 → activity
 *   - 其餘預設 → attraction
 *   - confidence < 80% → 寫入 uncertain queue 供人工 review
 *
 * Usage:
 *   node scripts/migrate-entries-to-pois.js --dry-run [--trip <id>]
 *   node scripts/migrate-entries-to-pois.js --apply   [--trip <id>]
 *
 * 附加：--clean-orphans 連同清理被刪 trip 殘留的 orphan POI（僅 --apply 模式有效）
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_NAME = 'trip-planner-db';
const REPORT_DIR = path.join(__dirname, '..', '.gstack', 'migration-reports');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const APPLY = args.includes('--apply');
const CLEAN_ORPHANS = args.includes('--clean-orphans');
const TRIP_FILTER = (() => {
  const i = args.indexOf('--trip');
  return i >= 0 && args[i + 1] && args[i + 1] !== 'all' ? args[i + 1] : null;
})();

if (!DRY_RUN && !APPLY) {
  console.error('必須指定 --dry-run 或 --apply');
  process.exit(1);
}
if (DRY_RUN && APPLY) {
  console.error('--dry-run 與 --apply 不可同時使用');
  process.exit(1);
}

const TRANSPORT_RE = /機場|空港|港|碼頭|站|駅|airport|station|port/i;
const ACTIVITY_RE = /浮潛|潛水|snorkel|diving|玉泉洞|鳳梨園|體驗|workshop|採|摘/i;

function classifyPoiType(entry) {
  const title = (entry.title || '').trim();
  const desc = entry.description || '';
  const note = entry.note || '';
  const text = `${title} ${desc} ${note}`;

  if (!title || title.length < 2) {
    return { type: 'attraction', confidence: 0.5, reason: 'empty/short title' };
  }
  if (TRANSPORT_RE.test(title)) {
    return { type: 'transport', confidence: 1.0, reason: 'title match transport keyword' };
  }
  if (ACTIVITY_RE.test(text)) {
    return { type: 'activity', confidence: 0.9, reason: 'text match activity keyword' };
  }
  return { type: 'attraction', confidence: 1.0, reason: 'default' };
}

function runD1Query(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  let raw;
  try {
    raw = execSync(
      `npx wrangler d1 execute ${DB_NAME} --remote --json --command "${escaped}"`,
      { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'inherit'] },
    );
  } catch (err) {
    console.error('D1 查詢失敗:', err.message?.slice(0, 200));
    process.exit(1);
  }
  const jsonStart = raw.indexOf('[');
  if (jsonStart < 0) return [];
  return JSON.parse(raw.slice(jsonStart))[0]?.results ?? [];
}

function runD1File(sqlFile) {
  try {
    execSync(
      `npx wrangler d1 execute ${DB_NAME} --remote --file "${sqlFile}"`,
      { encoding: 'utf8', timeout: 180000, stdio: 'inherit' },
    );
  } catch (err) {
    console.error('D1 apply 失敗:', err.message?.slice(0, 200));
    process.exit(1);
  }
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

console.log(`migrate-entries-to-pois.js — ${DRY_RUN ? 'dry-run' : 'APPLY'}${TRIP_FILTER ? ` [trip=${TRIP_FILTER}]` : ''}\n`);

// Step 1: 抓 legacy entries
const whereTrip = TRIP_FILTER ? `AND d.trip_id = ${sqlString(TRIP_FILTER)}` : '';
const sql = `
  SELECT e.id, e.day_id, e.title, e.description, e.note, e.maps, e.mapcode,
         e.google_rating, e.location, d.trip_id, d.day_num
  FROM trip_entries e
  JOIN trip_days d ON e.day_id = d.id
  WHERE e.poi_id IS NULL ${whereTrip}
  ORDER BY d.trip_id, d.day_num, e.sort_order
`.replace(/\s+/g, ' ').trim();

const entries = runD1Query(sql);
console.log(`掃到 ${entries.length} 個 legacy entries（poi_id IS NULL）`);

if (entries.length === 0) {
  console.log('✅ 沒有需要 backfill 的 entry');
  process.exit(0);
}

// Step 2: 分類 + 組 POI data
const classified = entries.map((e) => {
  const cls = classifyPoiType(e);
  const locObj = parseLocation(e.location);
  const name = (locObj?.name || e.title || '').trim();
  return {
    ...e,
    poiType: cls.type,
    confidence: cls.confidence,
    classifyReason: cls.reason,
    poiName: name,
    poiLat: locObj?.lat ?? null,
    poiLng: locObj?.lng ?? null,
    poiMapcode: locObj?.mapcode ?? e.mapcode ?? null,
    poiMaps: locObj?.googleQuery ?? e.maps ?? null,
  };
});

// Step 3: 產出統計 + uncertain 清單
const byType = classified.reduce((acc, c) => {
  acc[c.poiType] = (acc[c.poiType] || 0) + 1;
  return acc;
}, {});
const uncertain = classified.filter((c) => c.confidence < 0.8);
const missingName = classified.filter((c) => !c.poiName);

console.log('\n分類結果：');
for (const [t, n] of Object.entries(byType)) console.log(`  ${t}: ${n}`);
console.log(`\nconfidence < 80%：${uncertain.length}（SPEC gate: < 5% 共 ${Math.ceil(entries.length * 0.05)}）`);
console.log(`缺 POI name：${missingName.length}`);

if (uncertain.length / entries.length > 0.05) {
  console.warn(`\n⚠️ uncertain 超過 5% gate（${(uncertain.length / entries.length * 100).toFixed(1)}%），請審閱 uncertain.md 後再 --apply`);
}

// Step 4: 寫報告
fs.mkdirSync(REPORT_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(REPORT_DIR, `${ts}-${DRY_RUN ? 'dry-run' : 'apply'}.md`);
const uncertainPath = path.join(REPORT_DIR, `${ts}-uncertain.md`);

const reportLines = [
  `# migrate-entries-to-pois ${DRY_RUN ? 'dry-run' : 'apply'} — ${ts}`,
  '',
  `Trip filter: ${TRIP_FILTER || 'all'}`,
  `Total legacy entries: ${entries.length}`,
  '',
  '## 分類分布',
  '',
  ...Object.entries(byType).map(([t, n]) => `- ${t}: ${n}`),
  '',
  `## Uncertain (confidence < 0.8): ${uncertain.length}`,
  '',
  `## 缺 POI name: ${missingName.length}`,
  '',
  '## 全部明細',
  '',
  '| trip_id | day | entry_id | title | → type | conf | reason |',
  '|---|---|---|---|---|---|---|',
  ...classified.map((c) =>
    `| ${c.trip_id} | ${c.day_num} | ${c.id} | ${(c.title || '').slice(0, 30)} | ${c.poiType} | ${c.confidence} | ${c.classifyReason} |`,
  ),
];
fs.writeFileSync(reportPath, reportLines.join('\n'));
console.log(`\n報告：${reportPath}`);

if (uncertain.length > 0) {
  const uncertainLines = [
    `# Uncertain classifications — ${ts}`,
    '',
    'confidence < 0.8 的 entries，請人工決定 POI type 後再 apply。',
    '',
    '| trip_id | day | entry_id | title | 建議 type | conf | reason |',
    '|---|---|---|---|---|---|---|',
    ...uncertain.map((c) =>
      `| ${c.trip_id} | ${c.day_num} | ${c.id} | ${(c.title || '').slice(0, 40)} | ${c.poiType} | ${c.confidence} | ${c.classifyReason} |`,
    ),
  ];
  fs.writeFileSync(uncertainPath, uncertainLines.join('\n'));
  console.log(`Uncertain 清單：${uncertainPath}`);
}

if (DRY_RUN) {
  console.log('\n🔍 dry-run 完成 — 不修改資料。審閱報告後移除 --dry-run 改用 --apply 正式套用。');
  process.exit(0);
}

// Step 5: APPLY — 產生 SQL 檔 + 套用
const sqlFile = path.join(REPORT_DIR, `${ts}-apply.sql`);
const stmts = [];
const uniquePois = new Map();
for (const c of classified) {
  if (!c.poiName) continue;
  const key = `${c.poiType}\0${c.poiName}`;
  if (!uniquePois.has(key)) {
    uniquePois.set(key, {
      type: c.poiType,
      name: c.poiName,
      maps: c.poiMaps,
      mapcode: c.poiMapcode,
      lat: c.poiLat,
      lng: c.poiLng,
      google_rating: c.google_rating,
      description: c.description,
    });
  }
}

stmts.push('-- Phase 2 backfill — INSERT OR IGNORE pois + UPDATE trip_entries.poi_id');
for (const p of uniquePois.values()) {
  stmts.push(
    `INSERT OR IGNORE INTO pois (type, name, maps, mapcode, lat, lng, google_rating, description, source, country) VALUES (${sqlString(p.type)}, ${sqlString(p.name)}, ${sqlString(p.maps)}, ${sqlString(p.mapcode)}, ${sqlString(p.lat)}, ${sqlString(p.lng)}, ${sqlString(p.google_rating)}, ${sqlString(p.description)}, 'ai-backfill', 'JP');`,
  );
}
for (const c of classified) {
  if (!c.poiName) continue;
  stmts.push(
    `UPDATE trip_entries SET poi_id = (SELECT id FROM pois WHERE name = ${sqlString(c.poiName)} AND type = ${sqlString(c.poiType)} LIMIT 1) WHERE id = ${c.id};`,
  );
}

if (CLEAN_ORPHANS) {
  stmts.push('-- Clean orphan pois（無 trip_pois / trip_entries / poi_relations 引用）');
  stmts.push(`DELETE FROM pois WHERE id NOT IN (
    SELECT DISTINCT poi_id FROM trip_pois
    UNION SELECT DISTINCT poi_id FROM trip_entries WHERE poi_id IS NOT NULL
    UNION SELECT DISTINCT poi_id FROM poi_relations
    UNION SELECT DISTINCT related_poi_id FROM poi_relations
  );`);
}

fs.writeFileSync(sqlFile, stmts.join('\n'));
console.log(`\nSQL 檔：${sqlFile}`);
console.log(`執行 wrangler d1 execute ${DB_NAME} --remote --file ...\n`);
runD1File(sqlFile);

console.log('\n✅ apply 完成。跑 verify 腳本確認：node scripts/verify-entry-poi-backfill.js');
