#!/usr/bin/env node
'use strict';
/**
 * get-tripline-user-token.js — provide a USER-identity access_token for the
 * tp-request pipeline via OAuth refresh_token rotation.
 *
 * Contrast with sibling get-tripline-token.js: that mints a `client_credentials`
 * token (user_id=null → service token → hasWritePermission always false → cannot
 * write trip content). This exchanges a stored USER refresh_token for a user
 * access_token (carries user_id → passes hasWritePermission on the user's own
 * trips). Seed the initial refresh_token once via scripts/seed-user-refresh-token.mjs.
 *
 * Rotation safety (OAuth 2.1 §6.1 — refresh tokens are single-use; replaying a
 * consumed one triggers family cascade-revoke, see functions/api/oauth/token.ts:312):
 *   1. Refresh ONLY on access-token cache miss (~1 rotation/hour, not per call) —
 *      shrinks the rotation rate ~6x vs per-spawn.
 *   2. The rotated refresh_token AND the new access_token are persisted in ONE
 *      atomic write (temp+fsync+rename) BEFORE the access_token is returned, so a
 *      crash either lands both or neither — never a stranded/half state.
 *   3. In-process single-flight: concurrent callers share one rotation (a second
 *      concurrent refresh of the same token = family revoke). The api-server is the
 *      sole prod caller, so this fully covers normal operation.
 *
 * ponytail: the only unguarded concurrency is cross-PROCESS — e.g. running this
 * file's CLI mode while the api-server is mid-refresh. That's a manual, ~sub-second
 * window and fails closed (server cascade-revokes → we clear + alert → re-seed),
 * so it's documented rather than locked. Add a real flock only if it ever happens.
 *
 * On invalid_grant (family revoked / 30d expiry) the state is cleared and a typed
 * error is thrown; the caller (api-server) alerts the user to re-seed and falls
 * back to the read-only service token. NOTE the residual window: if the refresh
 * RESPONSE is lost after the server already consumed the token (network reset /
 * partial 5xx), state is kept and the next call replays the now-consumed token →
 * family revoke → re-seed. Unavoidable for rotation; recovery is the re-seed path.
 *
 * Env (required):
 *   TRIPLINE_TP_REQUEST_CLIENT_ID       confidential client provisioned for user auth
 *   TRIPLINE_TP_REQUEST_CLIENT_SECRET   its secret
 * Env (optional):
 *   TRIPLINE_API_BASE                   defaults to https://trip-planner-dby.pages.dev
 *   TRIPLINE_USER_TOKEN_DIR             state dir, defaults to ~/.tripline
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadEnvLocal } = require('./load-env');
loadEnvLocal();

const DEFAULT_BASE = 'https://trip-planner-dby.pages.dev';
const REFRESH_LEADTIME_SEC = 60; // treat access token as expired 60s early

/** Typed error so the caller can distinguish "re-seed needed" from transient. */
class UserTokenError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'UserTokenError';
    this.kind = kind; // 'NO_SEED' | 'REVOKED' | 'REFRESH_FAILED' | 'CONFIG'
  }
}

function stateDir() {
  return process.env.TRIPLINE_USER_TOKEN_DIR || path.join(os.homedir(), '.tripline');
}
const STATE_FILE = () => path.join(stateDir(), 'user-token-state.json');

/** Atomic write: temp + fsync + rename, 0600, dir 0700. Rename is atomic on POSIX
 *  so a crash mid-write never leaves a torn state file. */
function atomicWriteJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'w', 0o600);
  try {
    fs.writeSync(fd, JSON.stringify(obj));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

/** Single-file store: refresh_token + client_id + cached access_token all live in
 *  one JSON so a rotation is one atomic write, and clear() is one unlink. Seam for
 *  unit tests to inject an in-memory fake. */
function fileStore() {
  return {
    load() {
      try {
        return JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8'));
      } catch {
        return null;
      }
    },
    save(state) {
      atomicWriteJson(STATE_FILE(), state);
    },
    clear() {
      try {
        fs.unlinkSync(STATE_FILE());
      } catch {
        /* already gone */
      }
    },
  };
}

/**
 * Core token provider — pure w.r.t. injected `store` / `fetchImpl` / `now`, so the
 * rotation ordering and error paths are unit-testable without a server or fs.
 * Returns an access_token string; throws UserTokenError on unrecoverable states.
 */
async function provideUserToken({ store, fetchImpl, now, base, clientId, clientSecret }) {
  const nowSec = Math.floor(now() / 1000);
  const state = store.load();

  if (state && state.access_token && state.expires_at - REFRESH_LEADTIME_SEC > nowSec) {
    return state.access_token;
  }

  const refreshToken = state && state.refresh_token;
  if (!refreshToken) {
    throw new UserTokenError('NO_SEED', 'No user refresh token — run scripts/seed-user-refresh-token.mjs');
  }
  if (!clientId || !clientSecret) {
    throw new UserTokenError('CONFIG', 'Missing TRIPLINE_TP_REQUEST_CLIENT_ID / _SECRET');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetchImpl(`${base}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json.access_token) {
    // invalid_grant = the refresh family was revoked (reuse detected) or expired.
    // No retry recovers it — clear state so we fail fast into re-seed.
    if (json.error === 'invalid_grant') {
      store.clear();
      throw new UserTokenError('REVOKED', `User refresh token revoked/expired: ${json.error_description || ''} — re-seed required`);
    }
    throw new UserTokenError('REFRESH_FAILED', `Token refresh failed (${res.status}): ${json.error || ''} ${json.error_description || ''}`);
  }

  // One atomic write: rotated refresh_token (or keep old if the server didn't
  // rotate) + the new cached access_token, together, BEFORE returning.
  store.save({
    refresh_token: json.refresh_token || refreshToken,
    client_id: clientId,
    access_token: json.access_token,
    expires_at: nowSec + (json.expires_in || 3600),
  });
  return json.access_token;
}

// ---- Real-world entry: in-process single-flight over the file store ----

let inflight = null; // concurrent callers share one rotation (double-rotate = family revoke)

function realDeps() {
  return {
    store: fileStore(),
    fetchImpl: fetch,
    now: () => Date.now(),
    base: process.env.TRIPLINE_API_BASE || DEFAULT_BASE,
    clientId: process.env.TRIPLINE_TP_REQUEST_CLIENT_ID,
    clientSecret: process.env.TRIPLINE_TP_REQUEST_CLIENT_SECRET,
  };
}

/**
 * Public API. Returns a fresh-or-cached USER access_token. Throws UserTokenError.
 * `deps` is injectable for tests; production passes none (real fs/fetch/env).
 */
async function getUserToken(deps) {
  if (inflight) return inflight;
  inflight = provideUserToken(deps || realDeps()).finally(() => {
    inflight = null;
  });
  return inflight;
}

module.exports = { getUserToken, provideUserToken, fileStore, UserTokenError };

// CLI mode — prints a user access_token to stdout (for debugging).
if (require.main === module) {
  getUserToken()
    .then((tok) => {
      process.stdout.write(tok);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`${err.name || 'Error'}[${err.kind || '?'}]: ${err.message}`);
      process.exit(1);
    });
}
