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
// CF Pages 慣例：D1 binding 在 [[env.production.d1_databases]]（頂層只套 preview，prod 須
// env.production，見 wrangler.toml）。所以本機 wrangler d1 指令要 --env production 才找得到
// binding，否則 "Couldn't find a D1 DB with the name or binding 'trip-planner-db'"。
const ENV_FLAG = '--env production';
// 順序必須 FK-safe：父表在前，子表在後（test: tests/unit/init-local-db-table-order.test.ts）
const TABLES = ['trips', 'pois', 'trip_days', 'trip_entries', 'poi_relations', 'trip_docs', 'trip_doc_entries', 'trip_requests', 'trip_permissions'];

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
  execSync(`npx wrangler d1 migrations apply ${DB_NAME} --local ${ENV_FLAG}`, {
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

// 下面每一步都是 catch-and-continue，所以失敗要明確記下來 —— 否則整個 restore 全掛
// 也還是走到結尾印「✅ Local DB ready!」exit 0。
const failures = [];

// execSync 失敗時 err.message 是「Command failed: npx wrangler ...」，真正的原因
// （例如 `table trips has no column named owner`）在 stderr。
const errDetail = (err) => err.stderr?.toString().trim() || err.message || 'failed';

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
    execSync(`npx wrangler d1 execute ${DB_NAME} --local ${ENV_FLAG} --file "${tmpFile}"`, {
      encoding: 'utf8',
      timeout: 60000,
      stdio: 'pipe',
    });
    console.log(`  ✓ ${table}: ${rows.length} rows`);
  } catch (err) {
    console.error(`  ✗ ${table}: ${errDetail(err)}`);
    failures.push(`${table} 匯入失敗`);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

// Step 2.5: V2 cutover compat — fixup users + trips.owner for legacy display names
// (seed/backup data has trips.owner = display name; V2 cutover requires email)
const fixupSql = path.join(__dirname, 'fixup-local-users.sql');
if (fs.existsSync(fixupSql)) {
  console.log('\nStep 2.5/4: V2 cutover compat fixup (users + trips.owner)...');
  try {
    execSync(`npx wrangler d1 execute ${DB_NAME} --local ${ENV_FLAG} --file "${fixupSql}"`, {
      encoding: 'utf8',
      timeout: 30000,
      stdio: 'pipe',
    });
    console.log('  ✓ fixup applied');
  } catch (err) {
    console.error(`  ✗ fixup failed: ${errDetail(err)}`);
    failures.push('users / trips.owner fixup 失敗（V2 cutover 後登入會壞）');
  }
}

// Step 3: Verify
console.log('\nStep 3/4: Verifying...');
for (const table of TABLES) {
  try {
    const raw = execSync(
      `npx wrangler d1 execute ${DB_NAME} --local ${ENV_FLAG} --json --command "SELECT COUNT(*) as c FROM ${table}"`,
      { encoding: 'utf8', timeout: 10000 },
    );
    // 抓 JSON 陣列開頭 `[`+空白+`{`（跳過 wrangler 前綴 warning，含 `[WARNING]` 那種帶 '[' 的）
    const m = raw.match(/\[\s*\{/);
    const count = m ? JSON.parse(raw.slice(m.index))[0]?.results?.[0]?.c : undefined;
    if (count === undefined) {
      // 「數不出來」不是一個 row 數（以前這裡印 `?` 就算過）。
      console.error(`  ✗ ${table}: 數不出 row 數（wrangler 輸出解析失敗）`);
      failures.push(`${table} 無法驗證`);
    } else {
      console.log(`  ${table}: ${count} rows`);
    }
  } catch (err) {
    console.error(`  ✗ ${table}: ${errDetail(err)}`);
    failures.push(`${table} 驗證失敗`);
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
  // 跳過 sync = pages dev（npm run dev）會連到一個沒有剛才那批資料的 DB。
  // 這不是可以聳肩帶過的 warning。
  console.error('  ✗ 讀不到 wrangler.toml 的 database_id — pages dev 會連到未同步的 DB');
  failures.push('database_id 讀取失敗 → pages dev 的 DB 沒同步到');
}

if (failures.length > 0) {
  console.error(`\n❌ Local DB 沒有 ready — ${failures.length} 個步驟失敗：`);
  for (const f of failures) console.error(`   • ${f}`);
  console.error(
    '\n最常見原因：backups/ 的傾印欄位與現在的 migrations/ schema 對不上 —— 傾印裡有的欄，' +
      '\n表上已經沒有了（欄位改名或 DROP）。INSERT 具名該欄 → 逐行 SQLITE_ERROR → 該表 0 筆。' +
      '\n上面每個 ✗ 的第一行就是 SQLite 講的實際欄名，照它查。' +
      '\n解法：撈一份新傾印（傾印要比最後一個 migration 新），或對舊傾印套 migrations/rollback/。',
  );
  process.exit(1);
}

console.log('\n✅ Local DB ready! Run: npm run dev');
