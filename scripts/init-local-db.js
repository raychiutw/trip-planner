#!/usr/bin/env node
/**
 * init-local-db.js — 一鍵初始化本機 SQLite 開發環境
 *
 * 1. 跑所有 migrations（建表）
 * 2. 從最新 backup JSON 匯入資料
 * 3. 驗證
 * 4. 同步 DB 給 pages dev（miniflare hash 不同）
 *
 * Usage: node scripts/init-local-db.js [--reset]
 *   --reset  清除現有本機 DB 重新建立
 */

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const RESET = process.argv.includes('--reset');
const DB_NAME = 'trip-planner-db';
// 順序必須 FK-safe：父表在前，子表在後（test: tests/unit/init-local-db-table-order.test.ts）
const TABLES = ['trips', 'trip_days', 'pois', 'trip_entries', 'trip_pois', 'poi_relations', 'trip_docs', 'trip_doc_entries', 'trip_requests', 'trip_permissions'];

console.log('init-local-db.js — 本機 SQLite 初始化\n');

// Step 0: Reset if requested
if (RESET) {
  console.log('[reset] Clearing local D1 data...');
  const d1Dir = path.join(__dirname, '..', '.wrangler', 'state', 'v3', 'd1');
  if (fs.existsSync(d1Dir)) {
    fs.rmSync(d1Dir, { recursive: true, force: true });
    console.log('  Cleared .wrangler/state/v3/d1/');
  }
}

// Step 1: Run migrations
console.log('Step 1/4: Running migrations...');
try {
  execSync(`npx wrangler d1 migrations apply ${DB_NAME} --local`, {
    encoding: 'utf8',
    timeout: 30000,
    stdio: 'inherit',
  });
} catch (err) {
  console.error('Migration failed. If tables already exist, try: node scripts/init-local-db.js --reset');
  process.exit(1);
}

// Step 2: Find latest backup
console.log('\nStep 2/4: Importing data from backup...');
const backupsDir = path.join(__dirname, '..', 'backups');
const backups = fs.readdirSync(backupsDir)
  .filter(d => fs.statSync(path.join(backupsDir, d)).isDirectory() && d.match(/^\d{4}-/))
  .sort()
  .reverse();

if (backups.length === 0) {
  console.error('No backups found in backups/ directory.');
  process.exit(1);
}

const backupDir = path.join(backupsDir, backups[0]);
console.log(`  Using backup: ${backups[0]}`);

// Step 2b: Import each table
for (const table of TABLES) {
  const jsonFile = path.join(backupDir, `${table}.json`);
  if (!fs.existsSync(jsonFile)) {
    console.log(`  Skip ${table} (no backup file)`);
    continue;
  }

  const rows = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  if (rows.length === 0) {
    console.log(`  Skip ${table} (0 rows)`);
    continue;
  }

  // Build INSERT statements — escape newlines + single quotes for SQL
  const columns = Object.keys(rows[0]);
  const statements = rows.map(row => {
    const values = columns.map(col => {
      const v = row[col];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return String(v);
      const escaped = String(v).replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '');
      return `'${escaped}'`;
    });
    return `INSERT OR IGNORE INTO ${table} (${columns.join(',')}) VALUES (${values.join(',')});`;
  });

  // Write to temp file and execute
  const tmpFile = path.join(__dirname, `_init_${table}_${Date.now()}.sql`);
  fs.writeFileSync(tmpFile, statements.join('\n'));
  try {
    execSync(`npx wrangler d1 execute ${DB_NAME} --local --file "${tmpFile}"`, {
      encoding: 'utf8',
      timeout: 60000,
      stdio: 'pipe',
    });
    console.log(`  ✓ ${table}: ${rows.length} rows`);
  } catch (err) {
    console.log(`  ✗ ${table}: ${err.message?.substring(0, 80) || 'failed'}`);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

// Step 3: Verify
console.log('\nStep 3/4: Verifying...');
for (const table of TABLES) {
  try {
    const raw = execSync(
      `npx wrangler d1 execute ${DB_NAME} --local --json --command "SELECT COUNT(*) as c FROM ${table}"`,
      { encoding: 'utf8', timeout: 10000 },
    );
    const count = JSON.parse(raw.slice(raw.indexOf('[')))[0]?.results?.[0]?.c ?? '?';
    console.log(`  ${table}: ${count} rows`);
  } catch {
    console.log(`  ${table}: ERROR`);
  }
}

// Step 4: Sync DB for pages dev
// wrangler d1 execute uses database_id as the hash key, but pages dev uses binding name "DB".
// They produce different miniflare SQLite filenames — we need to copy data to both.
console.log('\nStep 4/4: Syncing DB for pages dev...');

function miniflareHash(uniqueKey, name) {
  const key = crypto.createHash('sha256').update(uniqueKey).digest();
  const nameHmac = crypto.createHmac('sha256', key).update(name).digest().subarray(0, 16);
  const hmac = crypto.createHmac('sha256', key).update(nameHmac).digest().subarray(0, 16);
  return Buffer.concat([nameHmac, hmac]).toString('hex');
}

const TOML_DB_ID = (() => {
  const toml = fs.readFileSync(path.join(__dirname, '..', 'wrangler.toml'), 'utf8');
  const m = toml.match(/database_id\s*=\s*"([^"]+)"/);
  return m ? m[1] : null;
})();

if (TOML_DB_ID) {
  const UK = 'miniflare-D1DatabaseObject';
  const d1Hash = miniflareHash(UK, TOML_DB_ID);
  const pagesHash = miniflareHash(UK, 'DB');
  const dir = path.join(__dirname, '..', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');

  if (d1Hash !== pagesHash) {
    const srcBase = path.join(dir, `${d1Hash}.sqlite`);
    const dstBase = path.join(dir, `${pagesHash}.sqlite`);
    const exts = ['', '-wal', '-shm'];

    for (const ext of exts) {
      const src = srcBase + ext;
      const dst = dstBase + ext;
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
      }
    }
    console.log(`  ✓ Copied ${d1Hash.slice(0, 8)}... → ${pagesHash.slice(0, 8)}...`);
  } else {
    console.log('  ✓ Same hash — no sync needed');
  }
} else {
  console.log('  ⚠ Could not read database_id from wrangler.toml — skip sync');
}

console.log('\n✅ Local DB ready! Run: npm run dev');
