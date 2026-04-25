#!/usr/bin/env node
/**
 * get-tripline-token.js — fetch & cache a V2 OAuth `client_credentials`
 * access_token for CLI scripts. Replaces the old CF Access Service Token
 * (`CF-Access-Client-Id` / `CF-Access-Client-Secret` headers).
 *
 * Usage:
 *
 *   const { getToken } = require('./lib/get-tripline-token');
 *   const token = await getToken();
 *   const res = await fetch('https://trip-planner-dby.pages.dev/api/foo', {
 *     headers: { 'Authorization': `Bearer ${token}` }
 *   });
 *
 *   # CLI mode (for shell scripts):
 *   node scripts/lib/get-tripline-token.js  # prints token to stdout
 *
 * Env (required):
 *   TRIPLINE_API_CLIENT_ID      — confidential client_id provisioned in Tripline
 *   TRIPLINE_API_CLIENT_SECRET  — corresponding secret (one-time output at registration)
 *
 * Env (optional):
 *   TRIPLINE_API_BASE     — defaults to https://trip-planner-dby.pages.dev
 *   TRIPLINE_API_SCOPES   — space-separated scopes; defaults to client's allowed_scopes
 *
 * Cache: /tmp/tripline-cli-token.json (per-uid). Refreshed when within 60s of expiry.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_BASE = 'https://trip-planner-dby.pages.dev';
const REFRESH_LEADTIME_SEC = 60; // refresh 1min before actual expiry to avoid edge races

function cachePath() {
  // per-uid file name so multi-user machines don't share token state
  const uid = (process.getuid && process.getuid()) || 0;
  return path.join(os.tmpdir(), `tripline-cli-token-${uid}.json`);
}

function readCache() {
  try {
    const raw = fs.readFileSync(cachePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.access_token === 'string' &&
      typeof parsed.expires_at === 'number' &&
      parsed.expires_at - REFRESH_LEADTIME_SEC > Math.floor(Date.now() / 1000)
    ) {
      return parsed.access_token;
    }
  } catch {
    /* missing / corrupt — fall through to fresh fetch */
  }
  return null;
}

function writeCache(token, expiresInSec) {
  const payload = {
    access_token: token,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
  };
  try {
    fs.writeFileSync(cachePath(), JSON.stringify(payload), { mode: 0o600 });
  } catch (err) {
    // Cache failure is non-fatal — caller still has the fresh token
    console.error('[get-tripline-token] cache write failed:', err.message);
  }
}

async function fetchFresh() {
  const clientId = process.env.TRIPLINE_API_CLIENT_ID;
  const clientSecret = process.env.TRIPLINE_API_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing TRIPLINE_API_CLIENT_ID or TRIPLINE_API_CLIENT_SECRET env. ' +
      'Provision via scripts/provision-admin-cli-client.js (admin only) ' +
      'and add both to your launchd plist or .env.local.',
    );
  }
  const base = process.env.TRIPLINE_API_BASE || DEFAULT_BASE;
  const scopes = process.env.TRIPLINE_API_SCOPES || 'admin';

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: scopes,
  });

  const res = await fetch(`${base}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Token fetch failed (${res.status}): ${json.error || ''} ${json.error_description || ''}`,
    );
  }
  writeCache(json.access_token, json.expires_in || 3600);
  return json.access_token;
}

/**
 * Public API — returns a fresh-or-cached access_token. Throws on auth failure.
 * Caller can `try/catch` and fall back to abort, retry, or human notification.
 */
async function getToken({ forceFresh = false } = {}) {
  if (!forceFresh) {
    const cached = readCache();
    if (cached) return cached;
  }
  return await fetchFresh();
}

/** Invalidate the cache — call this when an API call returns 401 to force refresh. */
function invalidateCache() {
  try {
    fs.unlinkSync(cachePath());
  } catch {
    /* already gone */
  }
}

module.exports = { getToken, invalidateCache };

// CLI mode — `node get-tripline-token.js` prints token to stdout for shell scripts:
//   TOKEN=$(node scripts/lib/get-tripline-token.js)
//   curl -H "Authorization: Bearer $TOKEN" ...
if (require.main === module) {
  getToken()
    .then((tok) => {
      process.stdout.write(tok);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
