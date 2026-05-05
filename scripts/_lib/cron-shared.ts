/**
 * cron-shared.ts — common helpers for mac mini cron scripts that hit Tripline API
 * + emit Telegram alerts.
 *
 * Auth model: V2 OAuth client_credentials flow (mirrors scripts/lib/get-tripline-token.js).
 *   Required env: TRIPLINE_API_CLIENT_ID + TRIPLINE_API_CLIENT_SECRET (provisioned via
 *   scripts/provision-admin-cli-client.js).
 *   Token is minted lazily on first API call + cached at /tmp/tripline-cli-token-${uid}.json
 *   (file shared with get-tripline-token.js so we hit the same cache).
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface CronEnv {
  apiUrl: string;
  clientId: string;
  clientSecret: string;
}

const DEFAULT_API = 'https://trip-planner-dby.pages.dev';
const REFRESH_LEADTIME_SEC = 60;

/** Load TRIPLINE_API_URL + TRIPLINE_API_CLIENT_ID/SECRET from env then .env.local fallback. */
export function loadCronEnv(): CronEnv {
  const envPath = join(process.cwd(), '.env.local');
  const raw = (() => {
    try { return readFileSync(envPath, 'utf-8'); } catch { return ''; }
  })();
  const map = new Map<string, string>();
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    map.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim().replace(/^"|"$/g, ''));
  }
  // TRIPLINE_API_BASE = CF Pages deployment (admin endpoints + new v2.23 endpoints).
  // TRIPLINE_API_URL = mac mini Tailscale funnel (legacy /api routes only) — DO NOT USE.
  const apiUrl = (
    process.env.TRIPLINE_API_BASE ||
    map.get('TRIPLINE_API_BASE') ||
    DEFAULT_API
  ).trim();
  const clientId = (process.env.TRIPLINE_API_CLIENT_ID || map.get('TRIPLINE_API_CLIENT_ID') || '').trim();
  const clientSecret = (process.env.TRIPLINE_API_CLIENT_SECRET || map.get('TRIPLINE_API_CLIENT_SECRET') || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'Required env: TRIPLINE_API_CLIENT_ID + TRIPLINE_API_CLIENT_SECRET (provision via scripts/provision-admin-cli-client.js)',
    );
  }
  return { apiUrl, clientId, clientSecret };
}

function cachePath(): string {
  const uid = (process.getuid && process.getuid()) || 0;
  return join(tmpdir(), `tripline-cli-token-${uid}.json`);
}

function readTokenCache(): string | null {
  try {
    if (!existsSync(cachePath())) return null;
    const parsed = JSON.parse(readFileSync(cachePath(), 'utf-8')) as {
      access_token?: string; expires_at?: number;
    };
    if (
      typeof parsed.access_token === 'string' &&
      typeof parsed.expires_at === 'number' &&
      parsed.expires_at - REFRESH_LEADTIME_SEC > Math.floor(Date.now() / 1000)
    ) {
      return parsed.access_token;
    }
  } catch { /* corrupt cache — fall through */ }
  return null;
}

function writeTokenCache(token: string, expiresInSec: number): void {
  const payload = {
    access_token: token,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
  };
  try {
    writeFileSync(cachePath(), JSON.stringify(payload), { mode: 0o600 });
  } catch { /* cache failure non-fatal */ }
}

async function mintToken(env: CronEnv, scopes = 'admin'): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.clientId,
    client_secret: env.clientSecret,
    scope: scopes,
  });
  const res = await fetch(`${env.apiUrl}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string; expires_in?: number; error?: string; error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(`Token mint failed (${res.status}): ${json.error || ''} ${json.error_description || ''}`);
  }
  writeTokenCache(json.access_token, json.expires_in || 3600);
  return json.access_token;
}

/** Bound API client — auto-mints OAuth Bearer token + retries once on 401. */
export function makeApiClient(env: CronEnv) {
  let token: string | null = readTokenCache();
  return async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!token) token = await mintToken(env);
    let res = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      token = await mintToken(env);
      res = await fetch(`${env.apiUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  };
}

/** Telegram alert (best-effort). */
export async function alertTelegram(msg: string): Promise<void> {
  const tok = process.env.TELEGRAM_BOT_TOKEN || '';
  const chat = process.env.TELEGRAM_CHAT_ID || '';
  if (!tok || !chat) return;
  await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: msg }),
  }).catch(() => undefined);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
