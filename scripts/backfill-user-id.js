#!/usr/bin/env node
/**
 * backfill-user-id.js — V2-P1 backfill prep script
 *
 * 對應 migration 0033（加 user_id columns nullable）。此 script 跑：
 *   1. SELECT DISTINCT email FROM saved_pois / trip_permissions / trip_ideas.added_by
 *   2. 對每個 distinct email，查 users.email 是否存在
 *      - 存在: take user_id
 *      - 不存在: skip（need user 自己 Google login first → users row 才會建）
 *   3. UPDATE saved_pois SET user_id = ? WHERE email = ? AND user_id IS NULL
 *      (similar for trip_permissions / trip_ideas.added_by → added_by_user_id)
 *
 * Idempotent — 跑多次只 update 沒 user_id 的 row（after first prod login wave 才有 effect）。
 *
 * Dry-run mode（default）：只印 report 不改 DB。`--apply` 才實際 UPDATE。
 *
 * Usage:
 *   node scripts/backfill-user-id.js                        # dry-run prod
 *   node scripts/backfill-user-id.js --apply                # 真跑 prod
 *   node scripts/backfill-user-id.js --local                # 跑 local D1
 *   node scripts/backfill-user-id.js --local --apply        # 真跑 local
 *
 * Env: CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, D1_DATABASE_ID（從 openspec/config.yaml fallback）
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const APPLY = process.argv.includes('--apply');
const LOCAL = process.argv.includes('--local');

function loadEnvFromYaml() {
  try {
    const content = fs.readFileSync(path.join(__dirname, '..', 'openspec', 'config.yaml'), 'utf8');
    const env = {};
    let inEnv = false;
    content.split('\n').forEach((line) => {
      if (/^env:/.test(line)) { inEnv = true; return; }
      if (inEnv && /^\S/.test(line)) { inEnv = false; return; }
      if (inEnv) {
        const m = line.match(/^\s+(\w+):\s*(.+)/);
        if (m && !m[2].startsWith('#') && !m[2].startsWith('(')) {
          env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/#.*$/, '').trim();
        }
      }
    });
    return env;
  } catch { return {}; }
}

const yamlEnv = loadEnvFromYaml();
const env = (k) => process.env[k] || yamlEnv[k] || '';

async function queryD1Remote(sql) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${env('CF_ACCOUNT_ID')}/d1/database/${env('D1_DATABASE_ID')}/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('CLOUDFLARE_API_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) throw new Error(`D1 ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.success) throw new Error(`D1 error: ${JSON.stringify(data.errors)}`);
  return data.result[0].results;
}

function queryD1Local(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  const out = execSync(
    `npx wrangler d1 execute trip-planner-db --local --json --command "${escaped}"`,
    { encoding: 'utf8', timeout: 30000 },
  );
  return JSON.parse(out.slice(out.indexOf('[')))[0]?.results ?? [];
}

const queryD1 = LOCAL ? queryD1Local : queryD1Remote;

async function main() {
  console.log(`backfill-user-id.js — ${APPLY ? 'APPLY' : 'DRY-RUN'} mode (${LOCAL ? 'local' : 'prod'})`);
  console.log('---');

  // 1. Distinct emails from 3 sources
  const savedPoiEmails = await queryD1(
    `SELECT DISTINCT email FROM saved_pois WHERE email IS NOT NULL AND user_id IS NULL`,
  );
  const permissionEmails = await queryD1(
    `SELECT DISTINCT email FROM trip_permissions WHERE email IS NOT NULL AND email != '*' AND user_id IS NULL`,
  );
  const ideaEmails = await queryD1(
    `SELECT DISTINCT added_by AS email FROM trip_ideas WHERE added_by IS NOT NULL AND added_by_user_id IS NULL`,
  );

  const allEmails = new Set([
    ...savedPoiEmails.map((r) => r.email),
    ...permissionEmails.map((r) => r.email),
    ...ideaEmails.map((r) => r.email),
  ]);

  console.log(`Distinct emails to backfill:`);
  console.log(`  saved_pois:        ${savedPoiEmails.length}`);
  console.log(`  trip_permissions:  ${permissionEmails.length}`);
  console.log(`  trip_ideas:        ${ideaEmails.length}`);
  console.log(`  Combined unique:   ${allEmails.size}`);

  // 2. Lookup users.id per email
  const emailToUid = new Map();
  let foundUsers = 0;
  for (const email of allEmails) {
    const rows = await queryD1(
      `SELECT id FROM users WHERE email = '${email.replace(/'/g, "''")}' LIMIT 1`,
    );
    if (rows.length > 0) {
      emailToUid.set(email, rows[0].id);
      foundUsers++;
    }
  }

  console.log(`---`);
  console.log(`Users found:    ${foundUsers} / ${allEmails.size}`);
  console.log(`Users missing:  ${allEmails.size - foundUsers} (這些 email 還沒 Google login)`);

  // 3. UPDATE rows (or report)
  let updates = 0;
  for (const [email, uid] of emailToUid) {
    const sqlSaved = `UPDATE saved_pois SET user_id = '${uid}' WHERE email = '${email.replace(/'/g, "''")}' AND user_id IS NULL`;
    const sqlPerm = `UPDATE trip_permissions SET user_id = '${uid}' WHERE email = '${email.replace(/'/g, "''")}' AND user_id IS NULL`;
    const sqlIdea = `UPDATE trip_ideas SET added_by_user_id = '${uid}' WHERE added_by = '${email.replace(/'/g, "''")}' AND added_by_user_id IS NULL`;

    if (APPLY) {
      await queryD1(sqlSaved);
      await queryD1(sqlPerm);
      await queryD1(sqlIdea);
    }
    updates++;
  }

  console.log(`---`);
  if (APPLY) {
    console.log(`✓ Applied ${updates} email→uid mappings to 3 tables`);
  } else {
    console.log(`Dry-run: ${updates} email→uid mappings would update 3 tables`);
    console.log(`Re-run with --apply to actually update.`);
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
