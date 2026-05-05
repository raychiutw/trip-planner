/**
 * cron-shared.ts — common helpers for mac mini cron scripts that hit Tripline API
 * + emit Telegram alerts. Used by scripts/google-* and other future cron jobs.
 *
 * Why a shared module: 3+ scripts duplicated identical loadEnv / api / alertTelegram
 * / sleep helpers (~80 lines each). Diverging copies became a maintenance hazard.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export interface CronEnv {
  apiUrl: string;
  token: string;
}

/** Load TRIPLINE_API_URL + TRIPLINE_API_TOKEN from process.env first, .env.local fallback. */
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
  const apiUrl = (process.env.TRIPLINE_API_URL || map.get('TRIPLINE_API_URL') || '').trim();
  const token = (process.env.TRIPLINE_API_TOKEN || map.get('TRIPLINE_API_TOKEN') || '').trim();
  if (!apiUrl || !token) {
    throw new Error('Required env: TRIPLINE_API_URL + TRIPLINE_API_TOKEN');
  }
  return { apiUrl, token };
}

/** Bound API client — Bearer auth + JSON content-type + non-2xx throw. */
export function makeApiClient(env: CronEnv) {
  return async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  };
}

/** Telegram alert (best-effort, swallows errors so scripts don't fail on alert hiccups). */
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
