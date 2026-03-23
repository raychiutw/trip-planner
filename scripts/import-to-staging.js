#!/usr/bin/env node
/**
 * Import production D1 backup to staging D1
 * Usage: node scripts/import-to-staging.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const BACKUP_DIR = path.join(__dirname, '../backups/2026-03-23T09-41-43');
const BATCH_SIZE = 20;

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  // Escape single quotes in strings
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function transformRow(table, row) {
  // requests: backup uses old `message` column, staging uses `title` + `body`
  // Also map status: received/processing/completed → closed
  if (table === 'requests' && 'message' in row) {
    const msg = row.message || '';
    const newlineIdx = msg.indexOf('\n');
    const title = newlineIdx > 0 ? msg.substring(0, newlineIdx) : msg;
    const body = newlineIdx > 0 ? msg.substring(newlineIdx + 1) : '';

    let status = row.status;
    if (['received', 'processing', 'completed'].includes(status)) {
      status = 'closed';
    }

    const transformed = { ...row, title, body, status };
    delete transformed.message;
    return transformed;
  }
  return row;
}

function generateInserts(table, rows) {
  if (!rows || rows.length === 0) return [];

  const transformedRows = rows.map(row => transformRow(table, row));
  const columns = Object.keys(transformedRows[0]);
  const batches = [];

  for (let i = 0; i < transformedRows.length; i += BATCH_SIZE) {
    const batch = transformedRows.slice(i, i + BATCH_SIZE);
    const valueRows = batch.map(row => {
      const vals = columns.map(col => escapeValue(row[col]));
      return `(${vals.join(', ')})`;
    });
    const sql = `INSERT INTO ${table} (${columns.map(c => `"${c}"`).join(', ')}) VALUES\n${valueRows.join(',\n')};`;
    batches.push(sql);
  }

  return batches;
}

function runSql(sql, label) {
  const tmpFile = path.join(os.tmpdir(), `d1-import-${Date.now()}.sql`);
  fs.writeFileSync(tmpFile, sql, 'utf8');
  try {
    execSync(
      `npx wrangler d1 execute trip-planner-db-staging --remote --env preview --file "${tmpFile}"`,
      { stdio: 'pipe', encoding: 'utf8' }
    );
  } catch (err) {
    console.error(`ERROR running ${label}:`, err.stdout || err.message);
    throw err;
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

async function main() {
  // Step 1: Clear all tables in FK-safe order (children first)
  console.log('Step 1: Clearing all tables in FK-safe order...');
  const clearSql = `
DELETE FROM shopping;
DELETE FROM restaurants;
DELETE FROM entries;
DELETE FROM hotels;
DELETE FROM trip_docs;
DELETE FROM requests;
DELETE FROM permissions;
DELETE FROM days;
DELETE FROM trips;
`.trim();
  runSql(clearSql, 'DELETE all tables');
  console.log('  ✅ All tables cleared');

  // Step 2: Import each table in parent-first order
  // Order: trips → days → hotels → entries → restaurants → shopping → trip_docs → requests → permissions
  const tables = [
    'trips',
    'days',
    'hotels',
    'entries',
    'restaurants',
    'shopping',
    'trip_docs',
    'requests',
    'permissions',
  ];

  for (const table of tables) {
    const filePath = path.join(BACKUP_DIR, `${table}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️  ${table}.json not found, skipping`);
      continue;
    }

    const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log(`  ⏭️  ${table}: 0 rows, skipping`);
      continue;
    }

    const batches = generateInserts(table, rows);
    console.log(`Step: Importing ${table} (${rows.length} rows, ${batches.length} batches)...`);

    for (let b = 0; b < batches.length; b++) {
      process.stdout.write(`  Batch ${b + 1}/${batches.length}...`);
      runSql(batches[b], `${table} batch ${b + 1}`);
      process.stdout.write(' ✅\n');
    }

    console.log(`  ✅ ${table}: ${rows.length} rows imported`);
  }

  console.log('\n✅ Import complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
