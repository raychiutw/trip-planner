#!/usr/bin/env node
// Dump all D1 trip data tables to backups/ directory
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tables = ['trips', 'days', 'hotels', 'entries', 'restaurants', 'shopping', 'trip_docs', 'requests', 'permissions'];
const backupDir = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const snapshotDir = path.join(backupDir, timestamp);
fs.mkdirSync(snapshotDir, { recursive: true });

console.log(`Dumping D1 data to ${snapshotDir}\n`);

const summary = {};

for (const table of tables) {
  try {
    const raw = execSync(
      `npx wrangler d1 execute trip-planner-db --remote --command "SELECT * FROM ${table};" --json`,
      { encoding: 'utf8', timeout: 30000 }
    );
    // wrangler --json outputs wrangler banner lines before JSON, find the JSON array
    const jsonStart = raw.indexOf('[');
    const parsed = JSON.parse(raw.slice(jsonStart));
    const rows = parsed[0]?.results || [];
    fs.writeFileSync(path.join(snapshotDir, `${table}.json`), JSON.stringify(rows, null, 2));
    summary[table] = rows.length;
    console.log(`  ✓ ${table}: ${rows.length} rows`);
  } catch (err) {
    console.error(`  ✗ ${table}: ${err.message}`);
    summary[table] = 'ERROR';
  }
}

// Write summary
fs.writeFileSync(path.join(snapshotDir, '_summary.json'), JSON.stringify({ timestamp, summary }, null, 2));
console.log(`\nDone! Summary: ${JSON.stringify(summary)}`);
