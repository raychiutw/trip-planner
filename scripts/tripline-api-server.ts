#!/usr/bin/env bun
/**
 * Tripline API Server — Mac Mini 上的請求處理服務
 *
 * D1 是唯一的佇列。收到 trigger 後從 CF API 撈 open 請求依序處理。
 * 用 Bun HTTP server 監聽 port 6688，Caddy 反向代理 Tailscale Funnel。
 *
 * Endpoints:
 *   POST /trigger?source=api|job  — 啟動處理迴圈
 *   GET  /health                  — 健康檢查
 */

import { spawn } from 'child_process';
import { appendFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// --- Load .env.local ---
const envPath = join(import.meta.dir, '..', '.env.local');
try {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch {}

// --- Config ---
const PORT = parseInt(process.env.TRIPLINE_PORT || '6688', 10);
const API_SECRET = process.env.TRIPLINE_API_SECRET || '';
const API_BASE = 'https://trip-planner-dby.pages.dev/api';
const PROJECT_DIR = process.env.PROJECT_DIR || join(import.meta.dir, '..');
const LOG_DIR = join(PROJECT_DIR, 'scripts', 'logs', 'api-server');
const CLAUDE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_HELPER = join(PROJECT_DIR, 'scripts', 'lib', 'get-tripline-token.js');

// --- Logging ---
mkdirSync(LOG_DIR, { recursive: true });

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function log(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  process.stdout.write(line);
  try { appendFileSync(join(LOG_DIR, `${todayStr()}.log`), line); } catch {}
}

function logError(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [error] ${msg}\n`;
  process.stderr.write(line);
  try { appendFileSync(join(LOG_DIR, `${todayStr()}.log`), line); } catch {}
  try { appendFileSync(join(LOG_DIR, `${todayStr()}.error.log`), line); } catch {}
}

// --- API helpers ---
// V2 OAuth client_credentials replaces CF Access Service Token. The token helper
// caches in /tmp; on 401 we invalidate and retry once via require() reload.
const tokenHelper = require(TOKEN_HELPER) as {
  getToken: (opts?: { forceFresh?: boolean }) => Promise<string>;
  invalidateCache: () => void;
};

async function authHeaders(forceFresh = false): Promise<Record<string, string>> {
  const token = await tokenHelper.getToken({ forceFresh });
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Origin': API_BASE.replace('/api', ''),
  };
}

/** fetch wrapper that auto-retries once on 401 with a fresh token. */
async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...(init.headers as Record<string, string> ?? {}), ...(await authHeaders()) };
  let res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    tokenHelper.invalidateCache();
    const freshHeaders = { ...(init.headers as Record<string, string> ?? {}), ...(await authHeaders(true)) };
    res = await fetch(url, { ...init, headers: freshHeaders });
  }
  return res;
}

interface TripRequest {
  id: number;
  trip_id: string;
  mode: string;
  message: string;
  status: string;
}

async function fetchOldestOpen(): Promise<TripRequest | null> {
  const res = await authedFetch(`${API_BASE}/requests?status=open&limit=1&sort=asc`);
  if (!res.ok) {
    logError(`fetchOldestOpen failed: ${res.status}`);
    return null;
  }
  const data = await res.json() as { items?: TripRequest[] } | TripRequest[];
  const items = Array.isArray(data) ? data : (data.items ?? []);
  return items[0] ?? null;
}

async function patchStatus(
  id: number,
  status: string,
  extra?: { processed_by?: string },
): Promise<boolean> {
  const body: Record<string, string> = { status };
  if (extra?.processed_by) body.processed_by = extra.processed_by;

  const res = await authedFetch(`${API_BASE}/requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    logError(`patchStatus(${id}, ${status}) failed: ${res.status}`);
    return false;
  }
  return true;
}

function runClaude(): Promise<boolean> {
  return new Promise((resolve) => {
    const claudePath = '/Users/ray/.local/bin/claude';
    const proc = spawn(claudePath, ['--dangerously-skip-permissions', '-p', '/tp-request'], {
      cwd: PROJECT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, HOME: process.env.HOME, PATH: `${process.env.PATH}:/Users/ray/.local/bin` },
    });

    const MAX_BUF = 10_000; // cap buffer to avoid unbounded memory
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { if (stdout.length < MAX_BUF) stdout += d.toString().slice(0, MAX_BUF - stdout.length); });
    proc.stderr.on('data', (d: Buffer) => { if (stderr.length < MAX_BUF) stderr += d.toString().slice(0, MAX_BUF - stderr.length); });

    const timer = setTimeout(() => {
      logError('Claude timeout — killing process');
      proc.kill('SIGTERM');
      setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL'); }, 5000);
    }, CLAUDE_TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        log(`Claude completed (${stdout.length} bytes output)`);
        resolve(true);
      } else {
        logError(`Claude failed (exit ${code}): ${stderr.slice(0, 200)}`);
        resolve(false);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      logError(`Claude spawn error: ${err.message}`);
      resolve(false);
    });
  });
}

// --- Process Loop ---
let isRunning = false;
let lastProcessed: string | null = null;
let processedCount = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

async function processLoop(source: 'api' | 'job') {
  if (isRunning) return false;
  isRunning = true;
  log(`Process loop started (source: ${source})`);

  let consecutiveFailures = 0;

  try {
    while (true) {
      const req = await fetchOldestOpen();
      if (!req) {
        log('No open requests, loop done');
        break;
      }

      log(`Processing request ${req.id} (trip: ${req.trip_id}, mode: ${req.mode})`);
      const claimed = await patchStatus(req.id, 'processing', { processed_by: source });
      if (!claimed) {
        logError(`Request ${req.id}: failed to claim (patchStatus → false), skipping`);
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          logError(`${MAX_CONSECUTIVE_FAILURES} consecutive failures, stopping loop`);
          break;
        }
        continue;
      }

      consecutiveFailures = 0;
      const success = await runClaude();
      log(`Request ${req.id} Claude ${success ? 'succeeded' : 'failed'}`);
      const finalStatus = success ? 'completed' : 'failed';
      const patched = await patchStatus(req.id, finalStatus);
      if (!patched) {
        logError(`Request ${req.id}: failed to patch final status '${finalStatus}'`);
      }

      log(`Request ${req.id} → ${finalStatus}`);
      lastProcessed = new Date().toISOString();
      processedCount++;
    }
  } catch (err) {
    logError(`Process loop error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    isRunning = false;
    log('Process loop ended');
  }
  return true;
}

// --- HTTP Server ---
function verifyAuth(req: Request): boolean {
  if (!API_SECRET) {
    logError('WARNING: TRIPLINE_API_SECRET not set — rejecting all requests');
    return false;
  }
  const authHeader = req.headers.get('Authorization') || '';
  return authHeader === `Bearer ${API_SECRET}`;
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS for health check
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } });
    }

    if (url.pathname === '/health' && req.method === 'GET') {
      return Response.json({
        running: isRunning,
        lastProcessed,
        processedCount,
        uptime: process.uptime(),
      });
    }

    if (url.pathname === '/trigger' && req.method === 'POST') {
      if (!verifyAuth(req)) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
      }

      const source = (url.searchParams.get('source') === 'job' ? 'job' : 'api') as 'api' | 'job';

      if (isRunning) {
        return Response.json({ already_running: true });
      }

      // 非同步啟動，立即回傳
      processLoop(source).catch((err) => {
        logError(`processLoop unhandled: ${err}`);
      });

      return Response.json({ triggered: true, source });
    }

    return Response.json({ error: 'not found' }, { status: 404 });
  },
});

log(`Tripline API Server listening on port ${PORT}`);
