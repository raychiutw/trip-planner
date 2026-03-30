#!/usr/bin/env node
/**
 * backfill-pois.js — 批次補齊 pois 表缺漏欄位
 *
 * 掃描 pois 表找缺漏 → 輸出報告（--dry-run）或用 PATCH /pois/:id 更新
 *
 * Usage:
 *   node scripts/backfill-pois.js --dry-run                    # 只看缺漏報告
 *   node scripts/backfill-pois.js --type hotel                 # 只補飯店
 *   node scripts/backfill-pois.js --field google_rating        # 只補 rating
 *   node scripts/backfill-pois.js                              # 補全部
 */

const { execSync } = require('child_process');
const DB_NAME = 'trip-planner-db';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TYPE_FILTER = args.find((_, i, a) => a[i - 1] === '--type') || null;
const FIELD_FILTER = args.find((_, i, a) => a[i - 1] === '--field') || null;

console.log(`backfill-pois.js — POI 欄位補齊${DRY_RUN ? '（dry-run 模式）' : ''}\n`);

// Step 1: Query missing fields
const whereClauses = [];
if (TYPE_FILTER) whereClauses.push(`type = '${TYPE_FILTER}'`);

const fieldChecks = [];
if (!FIELD_FILTER || FIELD_FILTER === 'google_rating') fieldChecks.push('google_rating IS NULL');
if (!FIELD_FILTER || FIELD_FILTER === 'maps') fieldChecks.push('maps IS NULL');
if (!FIELD_FILTER || FIELD_FILTER === 'address') fieldChecks.push('address IS NULL');

if (fieldChecks.length > 0) {
  whereClauses.push(`(${fieldChecks.join(' OR ')})`);
}

const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
const sql = `SELECT id, type, name, google_rating, maps, address, phone FROM pois ${where} ORDER BY type, name`;

let raw;
try {
  raw = execSync(
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command "${sql}"`,
    { encoding: 'utf8', timeout: 30000 },
  );
} catch (err) {
  console.error('D1 查詢失敗:', err.message?.substring(0, 100));
  process.exit(1);
}

const results = JSON.parse(raw.slice(raw.indexOf('[')))[0]?.results ?? [];

if (results.length === 0) {
  console.log('✅ 沒有缺漏的 POI！');
  process.exit(0);
}

// Step 2: Report
console.log(`找到 ${results.length} 個 POI 有缺漏欄位：\n`);

const byType = {};
for (const poi of results) {
  if (!byType[poi.type]) byType[poi.type] = [];
  byType[poi.type].push(poi);
}

for (const [type, pois] of Object.entries(byType)) {
  console.log(`  ${type} (${pois.length} 個):`);
  for (const p of pois) {
    const missing = [];
    if (p.google_rating === null) missing.push('rating');
    if (p.maps === null) missing.push('maps');
    if (p.address === null) missing.push('address');
    console.log(`    [${p.id}] ${p.name} — 缺: ${missing.join(', ')}`);
  }
  console.log();
}

if (DRY_RUN) {
  console.log('🔍 dry-run 模式 — 不修改資料。移除 --dry-run 執行正式補齊。');
  process.exit(0);
}

// Step 3: Patch (non-dry-run)
console.log('開始補齊（需要 Service Token）...\n');
console.log('⚠️ 自動補齊需要 WebSearch 查詢，請用 /tp-patch 執行。');
console.log('   /tp-patch --target all --field all');
console.log('\n或手動用 PATCH API：');
console.log('   curl -X PATCH -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \\');
console.log('     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"google_rating": 4.5, "address": "..."}\' \\');
console.log('     "https://trip-planner-dby.pages.dev/api/pois/{id}"');
