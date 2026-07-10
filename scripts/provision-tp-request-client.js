#!/usr/bin/env node
'use strict';
/**
 * provision-tp-request-client.js — register the confidential OAuth client that
 * lets tp-request obtain a USER-identity token (authorization_code + refresh_token
 * rotation), separate from the ops-only `tripline-internal-cli` client.
 *
 *   node scripts/provision-tp-request-client.js            # provision (once)
 *   node scripts/provision-tp-request-client.js --rotate-secret  # reissue secret
 *
 * Required env (same as provision-admin-cli-client.js — Ray已有):
 *   CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, D1_DATABASE_ID
 *
 * After running: save the printed CLIENT_ID/SECRET to .env.local as
 * TRIPLINE_TP_REQUEST_CLIENT_ID / _SECRET, then run
 * scripts/seed-user-refresh-token.mjs to seed the refresh token.
 *
 * The redirect_uri here MUST match scripts/seed-user-refresh-token.mjs
 * (http://127.0.0.1:{TRIPLINE_SEED_REDIRECT_PORT|8899}/callback).
 */
const path = require('path');
require('./lib/load-env').loadEnvLocal();
const { queryD1, execD1 } = require('./lib/d1-client');
const { generateClientSecret, hashPassword } = require('./lib/oauth-provision');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL_OVERRIDE || 'lean.lean@gmail.com';
const CLIENT_ID = process.env.TP_REQUEST_CLIENT_ID_OVERRIDE || 'tripline-tp-request';
const PORT = Number(process.env.TRIPLINE_SEED_REDIRECT_PORT || 8899);
const REDIRECT_URIS = JSON.stringify([`http://127.0.0.1:${PORT}/callback`]);
const ALLOWED_SCOPES = JSON.stringify(['openid', 'profile']);

if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CF_ACCOUNT_ID || !process.env.D1_DATABASE_ID) {
  console.error('Missing CLOUDFLARE_API_TOKEN / CF_ACCOUNT_ID / D1_DATABASE_ID env (see .env.local)');
  process.exit(2);
}

(async function main() {
  const userRows = await queryD1('SELECT id FROM users WHERE email = ? LIMIT 1', [ADMIN_EMAIL]);
  if (userRows.length === 0) {
    console.error(`User not found for "${ADMIN_EMAIL}". Sign up first, then re-run.`);
    process.exit(3);
  }
  const ownerUserId = userRows[0].id;

  const existing = await queryD1('SELECT client_id, status FROM client_apps WHERE client_id = ?', [CLIENT_ID]);
  if (existing.length > 0) {
    if (!process.argv.includes('--rotate-secret')) {
      console.error(`client_id "${CLIENT_ID}" already exists (status: ${existing[0].status}). Pass --rotate-secret to reissue.`);
      process.exit(4);
    }
    // Cascade-revoke live tokens for this client before reissue (same idiom as
    // provision-admin-cli-client.js — tokens live in oauth_models).
    const revoked = await execD1(
      "DELETE FROM oauth_models WHERE name IN ('AccessToken','RefreshToken') AND json_extract(payload, '$.client_id') = ?",
      [CLIENT_ID],
    );
    console.error(`Cascade revoked ${revoked} live token row(s) for ${CLIENT_ID}.`);
    await execD1('DELETE FROM client_apps WHERE client_id = ?', [CLIENT_ID]);
    console.error('Existing client deleted. Reissuing…');
  }

  const clientSecret = generateClientSecret();
  const clientSecretHash = await hashPassword(clientSecret);
  await execD1(
    `INSERT INTO client_apps
       (client_id, client_secret_hash, client_type, app_name, app_description,
        homepage_url, redirect_uris, allowed_scopes, owner_user_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      CLIENT_ID,
      clientSecretHash,
      'confidential',
      'Tripline tp-request (user auth)',
      'authorization_code + refresh_token client — lets the tp-request pipeline act as the trip owner',
      null,
      REDIRECT_URIS,
      ALLOWED_SCOPES,
      ownerUserId,
      'active',
    ],
  );

  console.log('=========================================');
  console.log('Provisioned tp-request user-auth client');
  console.log('=========================================');
  console.log(`TRIPLINE_TP_REQUEST_CLIENT_ID=${CLIENT_ID}`);
  console.log(`TRIPLINE_TP_REQUEST_CLIENT_SECRET=${clientSecret}`);
  console.log('');
  console.log('1. Save both to .env.local NOW (secret NOT recoverable — DB stores only the hash).');
  console.log(`2. redirect_uri registered: ${JSON.parse(REDIRECT_URIS)[0]}`);
  console.log('3. Seed the refresh token:  node scripts/seed-user-refresh-token.mjs');
  console.log('4. Enable:  set TP_REQUEST_USER_TOKEN=1 in the api-server env, then kickstart.');
  process.exit(0);
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
