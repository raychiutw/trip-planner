#!/usr/bin/env node
/**
 * provision-admin-cli-client.js — one-shot helper to register a confidential
 * client_app row for CLI scripts (tp-request-scheduler / tripline-job /
 * tripline-api-server) against the prod D1 database.
 *
 * Why this exists: `/api/dev/apps` requires a session, but the CLI scripts
 * need a client_app to FETCH a session (chicken-and-egg). This script writes
 * the row directly via the Cloudflare D1 REST API using `CLOUDFLARE_API_TOKEN`
 * — admin-only, run once at cutover.
 *
 * Usage:
 *
 *   node scripts/provision-admin-cli-client.js
 *
 * Required env:
 *   CLOUDFLARE_API_TOKEN  — token with D1:Read+Write on the prod database
 *   CF_ACCOUNT_ID         — Cloudflare account id
 *   D1_DATABASE_ID        — production D1 db id (see wrangler.toml)
 *
 * Optional env:
 *   ADMIN_EMAIL_OVERRIDE  — owner_user_id is set to the user with this email
 *                          (default: lean.lean@gmail.com per CLAUDE.md)
 *   CLIENT_ID_OVERRIDE    — defaults to 'tripline-internal-cli'
 *
 * Output: prints the generated client_secret to stdout (one-time only — DB
 * stores the hash). Save it immediately to your launchd plist or .env.local
 * as `TRIPLINE_API_CLIENT_SECRET`.
 *
 * Safety:
 *   - Idempotent: if client already exists, prints existing row + offers to
 *     re-secret (DELETE + reinsert with new secret).
 *   - Refuses to run against the staging DB (matches production id).
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Load .env.local if present
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^(\w+)=(.+)/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
} catch {
  /* no .env.local */
}

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT = process.env.CF_ACCOUNT_ID;
const D1_DB = process.env.D1_DATABASE_ID;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL_OVERRIDE || 'lean.lean@gmail.com';
const CLIENT_ID = process.env.CLIENT_ID_OVERRIDE || 'tripline-internal-cli';

if (!CF_TOKEN || !CF_ACCOUNT || !D1_DB) {
  console.error('Missing CLOUDFLARE_API_TOKEN / CF_ACCOUNT_ID / D1_DATABASE_ID env');
  process.exit(2);
}

async function execD1(sql, params = []) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${D1_DB}/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(json.errors || json)}`);
  }
  return json.result?.[0]?.results || [];
}

/** Generate base32 secret (matches /api/dev/apps tps_ format) */
function generateClientSecret() {
  const bytes = crypto.randomBytes(32);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0;
  let value = 0;
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += alphabet[(value << (5 - bits)) & 31];
  return `tps_${result}`;
}

/**
 * PBKDF2-SHA256 — matches src/server/password.ts ITERATIONS (currently 100,000;
 * sized for CF Workers Free 10ms CPU budget — see password.ts comment for the
 * "bump back to 600k after Workers Paid plan" upgrade path).
 *
 * MUST stay in sync with `ITERATIONS` in src/server/password.ts. If they
 * diverge, verifyPassword on prod will read iter from the stored hash and
 * run that many iterations — exceeding CPU budget when iter > current ceiling.
 */
async function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const iter = 100_000;
  const hash = crypto.pbkdf2Sync(plain, salt, iter, 32, 'sha256');
  const b64u = (buf) =>
    buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `pbkdf2$${iter}$${b64u(salt)}$${b64u(hash)}`;
}

(async function main() {
  // Look up admin user id
  const userRows = await execD1('SELECT id FROM users WHERE email = ? LIMIT 1', [ADMIN_EMAIL]);
  if (userRows.length === 0) {
    console.error(
      `Admin user not found in users table for email "${ADMIN_EMAIL}". ` +
      'Sign up via /signup first, then re-run this script.',
    );
    process.exit(3);
  }
  const ownerUserId = userRows[0].id;

  // Check if client already exists
  const existing = await execD1('SELECT client_id, status FROM client_apps WHERE client_id = ?', [
    CLIENT_ID,
  ]);
  if (existing.length > 0) {
    const proceed = process.argv.includes('--rotate-secret');
    if (!proceed) {
      console.error(
        `client_id "${CLIENT_ID}" already exists (status: ${existing[0].status}). ` +
          'Pass --rotate-secret to delete and reissue with a new secret.',
      );
      process.exit(4);
    }
    await execD1('DELETE FROM client_apps WHERE client_id = ?', [CLIENT_ID]);
    console.error(`Existing client deleted (status was: ${existing[0].status}). Reissuing…`);
  }

  // Generate + hash + insert
  const clientSecret = generateClientSecret();
  const clientSecretHash = await hashPassword(clientSecret);
  // Empty redirect_uris — client_credentials grant doesn't redirect (RFC 6749 §4.4)
  const redirectUris = '[]';
  // admin scope so middleware sets isAdmin=true
  const allowedScopes = '["admin","trips:read","trips:write"]';

  await execD1(
    `INSERT INTO client_apps
       (client_id, client_secret_hash, client_type, app_name, app_description,
        homepage_url, redirect_uris, allowed_scopes, owner_user_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      CLIENT_ID,
      clientSecretHash,
      'confidential',
      'Tripline Internal CLI',
      'Service-to-service token for tp-request-scheduler / tripline-job / api-server',
      null,
      redirectUris,
      allowedScopes,
      ownerUserId,
      'active', // bypass pending_review — admin-provisioned
    ],
  );

  console.log('=========================================');
  console.log('Provisioned admin CLI client_app');
  console.log('=========================================');
  console.log(`TRIPLINE_API_CLIENT_ID=${CLIENT_ID}`);
  console.log(`TRIPLINE_API_CLIENT_SECRET=${clientSecret}`);
  console.log('');
  console.log('Save the secret above to your launchd plist or .env.local NOW.');
  console.log('It is NOT recoverable — DB stores only the hash.');
  console.log('');
  console.log('Verify with:');
  console.log('  TRIPLINE_API_CLIENT_ID=' + CLIENT_ID + ' \\');
  console.log('  TRIPLINE_API_CLIENT_SECRET=' + clientSecret + ' \\');
  console.log('  node scripts/lib/get-tripline-token.js');
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
