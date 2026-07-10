#!/usr/bin/env node
/**
 * seed-user-refresh-token.mjs — one-time interactive seed for the tp-request user
 * token. Run this ONCE (as the trip owner, logged into the browser) to obtain the
 * initial USER refresh_token that scripts/lib/get-tripline-user-token.js then rotates.
 *
 *   node scripts/seed-user-refresh-token.mjs
 *
 * Flow (OAuth 2.1 authorization_code + PKCE):
 *   1. generate PKCE verifier/challenge + state, start a localhost callback server
 *   2. open the browser to /api/oauth/authorize (you log in + approve consent)
 *   3. capture the redirect ?code=…, exchange it at /api/oauth/token
 *   4. store the refresh_token via the same fileStore get-tripline-user-token uses
 *
 * Env (required):  TRIPLINE_TP_REQUEST_CLIENT_ID / TRIPLINE_TP_REQUEST_CLIENT_SECRET
 * Env (optional):  TRIPLINE_API_BASE, TRIPLINE_SEED_REDIRECT_PORT (default 8899)
 *
 * The redirect_uri below must EXACTLY match the client's registered redirect_uris.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
require(join(here, 'lib', 'load-env.js')).loadEnvLocal();
const { fileStore } = require(join(here, 'lib', 'get-tripline-user-token.js'));

const BASE = process.env.TRIPLINE_API_BASE || 'https://trip-planner-dby.pages.dev';
const CLIENT_ID = process.env.TRIPLINE_TP_REQUEST_CLIENT_ID;
const CLIENT_SECRET = process.env.TRIPLINE_TP_REQUEST_CLIENT_SECRET;
const PORT = Number(process.env.TRIPLINE_SEED_REDIRECT_PORT || 8899);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = 'openid profile';

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref();
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing TRIPLINE_TP_REQUEST_CLIENT_ID / TRIPLINE_TP_REQUEST_CLIENT_SECRET in .env.local');
    process.exit(1);
  }

  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  const authorizeUrl =
    `${BASE}/api/oauth/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPE)}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`;

  // Wait for the redirect callback, then exchange the code.
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
      if (u.pathname !== '/callback') {
        res.writeHead(404).end('not found');
        return;
      }
      const err = u.searchParams.get('error');
      const gotState = u.searchParams.get('state');
      const gotCode = u.searchParams.get('code');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      if (err) {
        res.end(`<h2>授權失敗：${err}</h2>可關閉此頁。`);
        server.close();
        reject(new Error(`authorize error: ${err}`));
        return;
      }
      if (gotState !== state) {
        res.end('<h2>state 不符（可能 CSRF）</h2>已中止。');
        server.close();
        reject(new Error('state mismatch'));
        return;
      }
      res.end('<h2>授權成功 ✓</h2>已取得 refresh token，可關閉此頁回終端機。');
      server.close();
      resolve(gotCode);
    });
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`\n在瀏覽器完成登入 + 授權（若沒自動開啟，手動貼上）：\n${authorizeUrl}\n`);
      openBrowser(authorizeUrl);
    });
    server.on('error', reject);
  });

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code_verifier: verifier,
  });
  const res = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.refresh_token) {
    console.error(`Token exchange 失敗 (${res.status}): ${json.error || ''} ${json.error_description || ''}`);
    process.exit(1);
  }

  fileStore().setRefreshToken(json.refresh_token, CLIENT_ID);
  console.log('\n✓ refresh token 已存入 ~/.tripline/user-token-state.json (0600)。');
  console.log('  啟用：在 api-server 環境設 TP_REQUEST_USER_TOKEN=1 後 kickstart。');
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
