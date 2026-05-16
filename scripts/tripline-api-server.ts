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

import { spawnSync } from 'child_process';
import { appendFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import nodemailer, { type Transporter } from 'nodemailer';
import { makeMailHandler } from './lib/mailer-handler';

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
const PROJECT_DIR = process.env.PROJECT_DIR || join(import.meta.dir, '..');
const LOG_DIR = join(PROJECT_DIR, 'scripts', 'logs', 'api-server');
const TOKEN_HELPER = join(PROJECT_DIR, 'scripts', 'lib', 'get-tripline-token.js');

// --- Mailer config (Gmail SMTP) ---
const GMAIL_USER = process.env.GMAIL_USERNAME || '';
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD || '';
const EMAIL_FROM_DEFAULT = process.env.EMAIL_FROM || `Tripline <${GMAIL_USER}>`;

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

// --- Token helper ---
// v2.30.7: API server 只用 token helper 一次（mint 後 inject 到 tmux session env）。
// queue drain + PATCH status 改由 /tp-request skill 自己做（curl + load-env.mjs）。
const tokenHelper = require(TOKEN_HELPER) as {
  getToken: (opts?: { forceFresh?: boolean }) => Promise<string>;
  invalidateCache: () => void;
};

// --- tmux session management ---
// v2.30.7: 改用 ephemeral tmux session 跑 claude（非 -p）。每個 /trigger 開
// 一個 `tripline-request-<timestamp>-<pid>` session，skill 處理完所有 request
// 後自殺（SKILL.md 結尾 tmux kill-session）。Orphan > 30min 由 cleanupOrphans
// 強取回收，token TTL (1h) 之內保證 cleanup。

const ORPHAN_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_PREFIX = 'tripline-request-';

// launchd PATH 不含 /opt/homebrew/bin，spawnSync(TMUX_BIN, ...) 抓不到。寫死絕對
// 路徑，與 claudePath 同 pattern。Intel Mac 用 /usr/local/bin/tmux — homebrew
// 預設位置不同，這邊偵測一次：找到的第一條存在路徑當 TMUX_BIN。
const TMUX_BIN = (() => {
  const candidates = ['/opt/homebrew/bin/tmux', '/usr/local/bin/tmux', '/usr/bin/tmux'];
  for (const p of candidates) {
    try {
      if (require('fs').existsSync(p)) return p;
    } catch {}
  }
  return 'tmux'; // fallback — let spawnSync resolve via PATH
})();

async function cleanupOrphans(maxAgeMs: number): Promise<number> {
  try {
    const result = spawnSync(TMUX_BIN, ['ls', '-F', '#{session_name} #{session_created}'], { encoding: 'utf-8' });
    // tmux ls exit 1 = no sessions exist — not an error
    if (result.status !== 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    let killed = 0;
    for (const line of (result.stdout || '').split('\n')) {
      const parts = line.split(' ');
      if (parts.length !== 2) continue;
      const [name, createdStr] = parts;
      if (!name.startsWith(SESSION_PREFIX)) continue;
      const created = parseInt(createdStr, 10);
      if (!created) continue;
      if ((now - created) * 1000 > maxAgeMs) {
        spawnSync(TMUX_BIN, ['kill-session', '-t', name]);
        log(`Cleaned orphan tmux session: ${name} (age=${now - created}s)`);
        killed++;
      }
    }
    return killed;
  } catch (err) {
    logError(`cleanupOrphans error: ${(err as Error).message}`);
    return 0;
  }
}

function hasActiveSession(): string | null {
  const result = spawnSync(TMUX_BIN, ['ls', '-F', '#{session_name}'], { encoding: 'utf-8' });
  if (result.status !== 0) return null;
  for (const line of (result.stdout || '').split('\n')) {
    if (line.startsWith(SESSION_PREFIX)) return line;
  }
  return null;
}

async function spawnTmuxRequest(): Promise<boolean> {
  // v2.22.0：claude /tp-request skill 用 `Authorization: Bearer $TRIPLINE_API_TOKEN`
  // 寫入 prod API（含 §6/§7/§8/§9 poi-favorites 4 條 path）。.env.local 只有
  // TRIPLINE_API_CLIENT_ID/SECRET，沒 TOKEN — 必須 mint 後 inject 到 tmux session
  // env，否則 skill 內 curl header 是 `Bearer ` (empty) → middleware 401。
  let token = '';
  try {
    token = await tokenHelper.getToken();
  } catch (err) {
    logError(`Token mint 失敗，tmux 不啟動：${(err as Error).message}`);
    return false;
  }

  const sessionName = `${SESSION_PREFIX}${Date.now()}-${process.pid}`;
  const claudePath = '/Users/ray/.local/bin/claude';

  // shell-escape token for the inline env assignment（避免 token 包含特殊字元）
  const escapedToken = token.replace(/'/g, `'\\''`);

  // Detached tmux session — claude 跑 interactive REPL（無 -p）。透過 env var 把
  // TRIPLINE_API_TOKEN + session name 傳給 skill；skill 結尾用 TRIPLINE_TMUX_SESSION
  // 自殺。--name 給 claude session 一個顯示名稱（同 tmux session）方便人類辨識。
  const create = spawnSync(TMUX_BIN, [
    'new-session', '-d', '-s', sessionName, '-c', PROJECT_DIR,
    `TRIPLINE_API_TOKEN='${escapedToken}' TRIPLINE_TMUX_SESSION='${sessionName}' PATH='${process.env.PATH}:/Users/ray/.local/bin' ${claudePath} --dangerously-skip-permissions --name '${sessionName}'`
  ], { encoding: 'utf-8' });
  if (create.status !== 0) {
    logError(`tmux new-session failed (status=${create.status}): ${create.stderr || ''}`);
    return false;
  }

  // 等 claude REPL 啟動（plugin sync / CLAUDE.md load）。2.5s 是經驗值；起太早
  // send-keys 可能輸入丟失。
  await new Promise(r => setTimeout(r, 2500));

  // 送 /tp-request 給 claude
  const send = spawnSync(TMUX_BIN, ['send-keys', '-t', sessionName, '/tp-request', 'Enter'], { encoding: 'utf-8' });
  if (send.status !== 0) {
    logError(`tmux send-keys failed: ${send.stderr || ''}`);
    spawnSync(TMUX_BIN, ['kill-session', '-t', sessionName]);
    return false;
  }

  log(`Spawned tmux session: ${sessionName} (fire-and-forget; skill self-destructs at end)`);
  return true;
}

// --- Process Loop ---
// v2.30.7: skill 自己 drain queue (查 status=processing/open/received → 依序處理)，
// API server 只負責「沒人在跑就 spawn 一隻」。多筆 stacked /trigger 期間若已有
// session 活著，後續 /trigger return early。
let isRunning = false;
let lastProcessed: string | null = null;
let processedCount = 0;

async function processLoop(source: 'api' | 'job'): Promise<boolean> {
  if (isRunning) {
    log(`processLoop: already running, skip (source=${source})`);
    return false;
  }
  isRunning = true;
  log(`Process loop started (source: ${source})`);

  try {
    // Cleanup orphans (>30min) — token TTL 是 1h，30min cleanup 保證 active session
    // 不會碰到 token expire
    const cleaned = await cleanupOrphans(ORPHAN_MAX_AGE_MS);
    if (cleaned > 0) log(`Cleaned ${cleaned} orphan session(s)`);

    // 只允許一個 active session — 既有 session 仍在處理 queue，不需重複 spawn
    const active = hasActiveSession();
    if (active) {
      log(`Active session ${active} still running, skip new spawn`);
      return false;
    }

    // Fire-and-forget tmux spawn — skill 內部 drain queue + 自殺
    const success = await spawnTmuxRequest();
    if (success) {
      lastProcessed = new Date().toISOString();
      processedCount++;
    }
    return success;
  } catch (err) {
    logError(`Process loop error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  } finally {
    isRunning = false;
    log('Process loop ended');
  }
}

// --- HTTP Server ---
/**
 * Constant-time Bearer token comparison — defends against timing side-channel
 * brute-force attacks now that /trigger and /internal/mail/send are publicly
 * reachable via Tailscale Funnel (--https=8443) without per-IP rate limits (Q12).
 *
 * Using subtle.timingSafeEqual on equal-length byte buffers; length mismatch
 * short-circuits to false (timing leak there is acceptable — only reveals
 * "wrong length", not byte-by-byte content).
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = new TextEncoder().encode(a);
  const bBuf = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBuf.length; i++) {
    diff |= aBuf[i]! ^ bBuf[i]!;
  }
  return diff === 0;
}

function verifyAuth(req: Request): boolean {
  if (!API_SECRET) {
    logError('WARNING: TRIPLINE_API_SECRET not set — rejecting all requests');
    return false;
  }
  const authHeader = req.headers.get('Authorization') || '';
  return constantTimeEqual(authHeader, `Bearer ${API_SECRET}`);
}

// --- Mailer (lazy SMTP transporter + handler) ---
let mailTransporter: Transporter | null = null;
function getMailTransporter(): Transporter {
  if (!mailTransporter) {
    if (!GMAIL_USER || !GMAIL_PASS) {
      throw new Error('GMAIL_USERNAME or GMAIL_APP_PASSWORD not set');
    }
    mailTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });
  }
  return mailTransporter;
}

const mailHandler = makeMailHandler({
  verifyAuth,
  transporter: getMailTransporter,
  emailFrom: EMAIL_FROM_DEFAULT,
  log,
  logError,
});

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

    if (url.pathname === '/internal/mail/send' && req.method === 'POST') {
      return await mailHandler(req);
    }

    return Response.json({ error: 'not found' }, { status: 404 });
  },
});

log(`Tripline API Server listening on port ${PORT}`);

// ── v2.30.18: 內建 15 分鐘 fallback cron ─────────────────────────────────
//
// 歷史 context：之前外部 launchd job 每 15 分鐘 POST /trigger（兜底 CF Pages
// 即時 trigger 失敗的場景，例如 Tailscale funnel 530）。v2.30.5 把 schedulers
// 改進 Claude Desktop Cowork 後，Cowork 的 scheduled-tasks.json 重啟會清空 →
// 觀察到 2026-05-07 起 cron 完全停跑，user-submitted chat 卡 open 至 11 天。
//
// 改進：直接在 api-server 內 setInterval，無外部依賴 — 只要 launchd 守住
// api-server 進程，cron 就活著。processLoop 內已有 isRunning 鎖防重入。
const CRON_INTERVAL_MS = 15 * 60 * 1000;
setInterval(() => {
  if (isRunning) return; // processLoop 自己會 skip，但先檢查避免 log noise
  processLoop('job').catch((err) => {
    logError(`internal cron processLoop unhandled: ${err}`);
  });
}, CRON_INTERVAL_MS);
log(`Internal cron started — processLoop every ${CRON_INTERVAL_MS / 60000} min`);
