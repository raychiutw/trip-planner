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
import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// --- Config ---
const PORT = parseInt(process.env.TRIPLINE_PORT || '6688', 10);
const API_SECRET = process.env.TRIPLINE_API_SECRET || '';
const CF_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID || '';
const CF_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET || '';
const API_BASE = 'https://trip-planner-dby.pages.dev/api';
const PROJECT_DIR = process.env.PROJECT_DIR || join(import.meta.dir, '..');
const LOG_DIR = join(PROJECT_DIR, 'scripts', 'logs');
const CLAUDE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// --- Logging ---
mkdirSync(LOG_DIR, { recursive: true });

function log(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  process.stdout.write(line);
  const logFile = join(LOG_DIR, `tripline-api-${new Date().toISOString().slice(0, 10)}.log`);
  try { appendFileSync(logFile, line); } catch {}
}

// --- API helpers ---
function cfHeaders(): Record<string, string> {
  return {
    'CF-Access-Client-Id': CF_CLIENT_ID,
    'CF-Access-Client-Secret': CF_CLIENT_SECRET,
    'Content-Type': 'application/json',
  };
}

interface TripRequest {
  id: number;
  trip_id: string;
  mode: string;
  message: string;
  status: string;
}

async function fetchOldestOpen(): Promise<TripRequest | null> {
  const res = await fetch(`${API_BASE}/requests?status=open&limit=1&sort=asc`, {
    headers: cfHeaders(),
  });
  if (!res.ok) {
    log(`fetchOldestOpen failed: ${res.status}`);
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

  const res = await fetch(`${API_BASE}/requests/${id}`, {
    method: 'PATCH',
    headers: cfHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    log(`patchStatus(${id}, ${status}) failed: ${res.status}`);
    return false;
  }
  return true;
}

function runClaude(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('claude', ['--dangerously-skip-permissions', '-p', '/tp-request'], {
      cwd: PROJECT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, HOME: process.env.HOME },
    });

    const MAX_BUF = 10_000; // cap buffer to avoid unbounded memory
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { if (stdout.length < MAX_BUF) stdout += d.toString().slice(0, MAX_BUF - stdout.length); });
    proc.stderr.on('data', (d: Buffer) => { if (stderr.length < MAX_BUF) stderr += d.toString().slice(0, MAX_BUF - stderr.length); });

    const timer = setTimeout(() => {
      log('Claude timeout — killing process');
      proc.kill('SIGTERM');
      setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL'); }, 5000);
    }, CLAUDE_TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        log(`Claude completed (${stdout.length} bytes output)`);
        resolve(true);
      } else {
        log(`Claude failed (exit ${code}): ${stderr.slice(0, 200)}`);
        resolve(false);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      log(`Claude spawn error: ${err.message}`);
      resolve(false);
    });
  });
}

// --- Process Loop ---
let isRunning = false;
let lastProcessed: string | null = null;
let processedCount = 0;

async function processLoop(source: 'api' | 'job') {
  if (isRunning) return false;
  isRunning = true;
  log(`Process loop started (source: ${source})`);

  try {
    while (true) {
      const req = await fetchOldestOpen();
      if (!req) {
        log('No open requests, loop done');
        break;
      }

      log(`Processing request ${req.id} (trip: ${req.trip_id}, mode: ${req.mode})`);
      await patchStatus(req.id, 'processing', { processed_by: source });

      const success = await runClaude();
      const finalStatus = success ? 'completed' : 'failed';
      await patchStatus(req.id, finalStatus);

      log(`Request ${req.id} → ${finalStatus}`);
      lastProcessed = new Date().toISOString();
      processedCount++;
    }
  } catch (err) {
    log(`Process loop error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    isRunning = false;
    log('Process loop ended');
  }
  return true;
}

// --- HTTP Server ---
function verifyAuth(req: Request): boolean {
  if (!API_SECRET) {
    log('WARNING: TRIPLINE_API_SECRET not set — rejecting all requests');
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
        log(`processLoop unhandled: ${err}`);
      });

      return Response.json({ triggered: true, source });
    }

    return Response.json({ error: 'not found' }, { status: 404 });
  },
});

log(`Tripline API Server listening on port ${PORT}`);
