#!/usr/bin/env node
/**
 * init-local-db.js — 一鍵初始化本機 SQLite 開發環境
 *
 * 1. 跑所有 migrations（建表）
 * 2. 從最新 backup JSON 匯入資料
 * 3. 驗證
 *
 * Usage: node scripts/init-local-db.js [--reset]
 *   --reset  清除現有本機 DB 重新建立
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RESET = process.argv.includes('--reset');
const DB_NAME = 'trip-planner-db';
const TABLES = ['trips', 'trip_days', 'trip_entries', 'pois', 'trip_pois', 'poi_relations', 'trip_docs', 'trip_requests', 'trip_permissions'];

console.log('init-local-db.js — 本機 SQLite 初始化\n');

// Step 0: Reset if requested
if (RESET) {
  console.log('[reset] Clearing local D1 state...');
  const stateDir = path.join(__dirname, '..', '.wrangler', 'state');
  if (fs.existsSync(stateDir)) {
    fs.rmSync(stateDir, { recursive: true, force: true });
    console.log('  Cleared .wrangler/state/');
  }
}

// Step 1: Run migrations
console.log('Step 1/3: Running migrations...');
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
console.log('\nStep 2/3: Importing data from backup...');
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
console.log('\nStep 3/3: Verifying...');
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

console.log('\n✅ Local DB ready! Run: npm run dev');
