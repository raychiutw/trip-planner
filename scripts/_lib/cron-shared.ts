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

/** Load TRIPLINE_API_URL + TRIPLINE_API_CLIENT_ID/SECRET from env then .env.local fallback.
 * v2.33.49 round 8a: align quote-strip with `lib/load-env.js` (handle both
 * single and double quotes; previously only `"` → silent value-corruption if
 * any secret is wrapped in single quotes). 同時驗 key 不含 shell metacharacter
 * (defense in depth — .env.local 是 source of truth)。
 */
export function loadCronEnv(): CronEnv {
  const envPath = join(process.cwd(), '.env.local');
  const raw = (() => {
    try { return readFileSync(envPath, 'utf-8'); } catch { return ''; }
  })();
  const map = new Map<string, string>();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = trimmed.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
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
    const p = cachePath();
    if (!existsSync(p)) return null;
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as {
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

// v2.33.50 round 8b: warn once when env missing (silent no-op 是 daily-check
// 本身要 surface 的故障模式)。模組級 flag 避免每次 alert spam stderr。
let _telegramEnvWarned = false;
/** Telegram alert (best-effort). */
export async function alertTelegram(msg: string): Promise<void> {
  const tok = process.env.TELEGRAM_BOT_TOKEN || '';
  const chat = process.env.TELEGRAM_CHAT_ID || '';
  if (!tok || !chat) {
    if (!_telegramEnvWarned) {
      _telegramEnvWarned = true;
      console.warn('[alertTelegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing — alerts disabled');
    }
    return;
  }
  // v2.33.50 round 8b LOW: validate token format defense in depth (同
  // send-telegram.sh v2.33.49 fix)。
  if (!/^[0-9]+:[A-Za-z0-9_-]+$/.test(tok)) {
    if (!_telegramEnvWarned) {
      _telegramEnvWarned = true;
      console.warn('[alertTelegram] TELEGRAM_BOT_TOKEN 格式不合法，alerts disabled');
    }
    return;
  }
  await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: msg }),
  }).catch(() => undefined);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── throttled-alert (TS variant) ──────────────────────────────────────────
//
// 配對 scripts/lib/throttled-alert.sh — 給 cron scripts / api-server 用同一
// state-transition + 1hr throttle 規則，避免 sustained failure 把 Telegram flood。
//
// State cache：~/.gstack/throttled-alert-<key>.state（若 ~/.gstack 不存在則 fallback /tmp）
// 格式 "state|epoch_seconds"。
//
// Rules（與 .sh 版完全對齊）：
//   - new="healthy" + prev != healthy/unknown → recovery alert always
//   - new="healthy" + prev=healthy/unknown → silent
//   - state change → alert
//   - same state → 每 ttlSec 一次（default 3600）

// (mkdirSync 取 node:fs；existsSync/readFileSync/writeFileSync + join 同 top imports)
import { mkdirSync } from 'fs';
import { homedir } from 'os';

const THROTTLE_DEFAULT_DIR = (() => {
  const gstack = join(homedir(), '.gstack');
  return existsSync(gstack) ? gstack : '/tmp';
})();

function stateFilePath(key: string, dir = THROTTLE_DEFAULT_DIR): string {
  const safe = key.replace(/[^A-Za-z0-9_-]/g, '_');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `throttled-alert-${safe}.state`);
}

function readState(file: string): { state: string; ts: number } {
  if (!existsSync(file)) return { state: 'unknown', ts: 0 };
  const raw = readFileSync(file, 'utf8').trim();
  const [state, tsStr] = raw.split('|');
  const ts = /^\d+$/.test(tsStr ?? '') ? Number(tsStr) : 0;
  return { state: state || 'unknown', ts };
}

function writeState(file: string, state: string, ts: number): void {
  writeFileSync(file, `${state}|${ts}\n`);
}

export function shouldSendAlert(
  prevState: string,
  newState: string,
  prevTs: number,
  now: number,
  ttlSec: number,
): boolean {
  if (newState === 'healthy' && prevState !== 'healthy' && prevState !== 'unknown') {
    return true; // recovery
  }
  if (newState === 'healthy') return false;
  if (prevState !== newState) return true;
  return now - prevTs >= ttlSec;
}

/**
 * Send Telegram alert respecting state-transition + throttle rules.
 *
 * @returns true if alert was sent, false if suppressed by throttle/steady-state
 */
export async function throttledAlert(
  key: string,
  newState: string,
  message: string,
  options?: { ttlSec?: number; stateDir?: string },
): Promise<boolean> {
  const ttlSec = options?.ttlSec ?? 3600;
  const file = stateFilePath(key, options?.stateDir);
  const { state: prevState, ts: prevTs } = readState(file);
  const now = Math.floor(Date.now() / 1000);

  if (shouldSendAlert(prevState, newState, prevTs, now, ttlSec)) {
    await alertTelegram(message);
    writeState(file, newState, now);
    return true;
  }
  // 保留舊 ts 維持 throttle window
  writeState(file, newState, prevTs);
  return false;
}
