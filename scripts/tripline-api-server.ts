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
import { computeNextDailyFire } from './lib/schedule-daily';
import { waitForRepl, submitSkillCommand, type TmuxDeps } from './lib/tmux-pane';
import { throttledAlert, sleep } from './_lib/cron-shared';

// --- Load .env.local ---
// v2.33.51 round 8c: 統一 parser — 之前 inline 邏輯不 strip 外 quote，跟
// sister script (lib/load-env.js / _lib/cron-shared) 行為不一致。
const envPath = join(import.meta.dir, '..', '.env.local');
try {
  for (const rawLine of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = rawLine.trim();
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
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

// --- Config ---
const PORT = parseInt(process.env.TRIPLINE_PORT || '6688', 10);
const API_SECRET = process.env.TRIPLINE_API_SECRET || '';
const PROJECT_DIR = process.env.PROJECT_DIR || join(import.meta.dir, '..');
const LOG_DIR = join(PROJECT_DIR, 'scripts', 'logs', 'api-server');
const TOKEN_HELPER = join(PROJECT_DIR, 'scripts', 'lib', 'get-tripline-token.js');
// v2.55.56: prod API base — peek pending requests + downscope the user token to one trip.
const API_BASE = process.env.TRIPLINE_API_BASE || 'https://trip-planner-dby.pages.dev';

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

// v2.55.54: 可選用 USER 身份 token 讓 tp-request 寫入行程內容（service token user_id=null →
// hasWritePermission 一律 false，改不了 entry/備選）。TP_REQUEST_USER_TOKEN=1 且 skill 為
// /tp-request 才啟用（其他 skill 是 ops 讀取，續用 service token）。預設 OFF → merge 進
// master 是 inert 的；Ray seed refresh token（scripts/seed-user-refresh-token.mjs）+ 開 flag
// 才生效。取得失敗 fallback 回 service token（read-only）不 crash spawn，並 alert 提示 re-seed。
const USER_TOKEN_HELPER = join(PROJECT_DIR, 'scripts', 'lib', 'get-tripline-user-token.js');
const userTokenHelper = require(USER_TOKEN_HELPER) as {
  getUserToken: () => Promise<string>;
};

function userTokenEnabled(skillCommand: string): boolean {
  const flag = process.env.TP_REQUEST_USER_TOKEN;
  return (flag === '1' || flag === 'true') && skillCommand.trim() === '/tp-request';
}

/** The Bearer to inject + the trip it may touch. restrictTrip is set only for a
 *  trip-scoped user token; undefined for the unrestricted read-only service token. */
interface AcquiredToken {
  token: string;
  restrictTrip?: string;
}

/** v2.55.56: peek the oldest pending request's trip so the injected user token can be
 *  downscoped to ONLY that trip (confused-deputy mitigation — an injected agent then
 *  physically can't write other trips). Uses the service token (ops:trips:read — same
 *  read the skill does to drain), priority mirrors the skill: processing → open →
 *  received, oldest-first. null = nothing pending to scope. */
async function peekPendingTripId(): Promise<string | null> {
  const svcToken = await tokenHelper.getToken();
  for (const status of ['processing', 'open', 'received'] as const) {
    try {
      const res = await fetch(`${API_BASE}/api/requests?status=${status}&sort=asc&limit=1`, {
        headers: { Authorization: `Bearer ${svcToken}` },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { items?: Array<{ trip_id?: unknown }> };
      const tripId = data.items?.[0]?.trip_id;
      if (typeof tripId === 'string' && tripId) return tripId;
    } catch {
      /* best-effort — try next status */
    }
  }
  return null;
}

/** v2.55.56: exchange the full user token for one restricted to `tripId` via
 *  POST /api/oauth/downscope (server re-verifies write perm + stamps restrict_trip). */
async function downscopeToken(userToken: string, tripId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/oauth/downscope`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ trip_id: tripId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw Object.assign(new Error(`downscope ${res.status}: ${detail.slice(0, 120)}`), { kind: 'DOWNSCOPE_FAILED' });
  }
  const data = (await res.json()) as { access_token?: unknown };
  if (typeof data.access_token !== 'string' || !data.access_token) {
    throw Object.assign(new Error('downscope response missing access_token'), { kind: 'DOWNSCOPE_FAILED' });
  }
  return data.access_token;
}

/** Acquire the Bearer to inject. For /tp-request when enabled: peek the pending trip →
 *  mint the user token → downscope it to that one trip. On any failure, alerts + degrades
 *  to the read-only service token rather than aborting. Returns null only if the service
 *  token also fails. */
async function acquireToken(skillCommand: string): Promise<AcquiredToken | null> {
  if (userTokenEnabled(skillCommand)) {
    try {
      // Only mint a user token bound to the ONE trip whose request we're about to
      // process — a prompt-injected agent then can't reach any other trip.
      const tripId = await peekPendingTripId();
      if (tripId) {
        const userToken = await userTokenHelper.getUserToken();
        const restricted = await downscopeToken(userToken, tripId);
        log(`user token downscoped to trip ${tripId}`);
        return { token: restricted, restrictTrip: tripId };
      }
      log('無 pending request 可 scope；改用 service token spawn');
    } catch (err) {
      const e = err as { kind?: string; message?: string };
      logError(`user token 取得/downscope 失敗（fallback service token，read-only）：[${e.kind ?? '?'}] ${e.message ?? err}`);
      void throttledAlert(
        `usertoken-${e.kind ?? 'unknown'}`,
        'failed',
        `tp-request user token 失效（${e.kind ?? '?'}）→ 暫用 read-only service token（寫不了行程）。修復：重跑 scripts/seed-user-refresh-token.mjs`,
      );
      // fall through to service token
    }
  }
  try {
    return { token: await tokenHelper.getToken() };
  } catch (err) {
    logError(`Token mint 失敗，tmux 不啟動：${(err as Error).message}`);
    return null;
  }
}

// --- tmux session management ---
// v2.30.7: 改用 ephemeral tmux session 跑 claude（非 -p）。每個 /trigger 開
// 一個 session（v2.33.27 起 per-skill 命名 `tripline-{slug}-<timestamp>-<pid>`，
// 例 `tripline-tp-request-...` / `tripline-tp-daily-check-...`），skill 處理完
// 所有 request 後自殺（SKILL.md 結尾 tmux kill-session）。Orphan 由
// cleanupOrphans 強制回收。
//
// 2026-07-07 request #237 incident：30min 上限會**誤殺還在工作的大 request
// session**（5 天×午晚餐×高評價餐廳搜尋 >30min）→ 反覆重做永遠做不完。
// 原 30min 是配合 token TTL (1h) 的保守值 — 現 SKILL.md 已加「長工作每
// ~40min 重取 token」指引（skill 本就自跑 get-tripline-token），TTL 不再是
// session 壽命上限。90min 平衡「大 request 完成窗」vs「真卡死 block 後續
// cron」（cron 10min 一輪，卡死最多 block 9 輪）。
const ORPHAN_MAX_AGE_MS = 90 * 60 * 1000; // 90 minutes
// v2.33.110: cleanupOrphans / hasActiveSession 的 prefix 從 allowlist derive，
// 不再 hardcode。原本 SESSION_PREFIX = 'tripline-request-' 僅 match legacy（v2.33.26 前）
// → v2.33.27 per-skill rename 後 orphan `tripline-tp-*-*` 完全不被清 → hasActiveSession
// 永真 → cron 每次 skip（2026-05-25 AI 健檢 request 209 卡 1h21m）。改用 allowlist-driven
// 既 cover 兩世代又不誤殺人類 `tripline-debug` 等 ad-hoc session。

// v2.33.27: per-skill session prefix。原本 SESSION_PREFIX 對所有 skill 共用，
// v2.33.49 round 8a security audit: skillCommand allowlist — 之前 sessionPrefixForSkill
// 只 lowercase + 拔 leading /，無嚴格驗證。任何未來 PR 把 skill 暴露給 HTTP query
// 都會引入 shell-quote / command injection。明定 allowlist 防止 design widening。
const ALLOWED_SKILLS = new Set(['/tp-request', '/tp-daily-check']);
function assertAllowedSkill(skillCommand: string): string {
  if (!ALLOWED_SKILLS.has(skillCommand)) {
    throw new Error(`Disallowed skillCommand: ${skillCommand.slice(0, 40)} (allowlist: ${[...ALLOWED_SKILLS].join(', ')})`);
  }
  return skillCommand;
}

// hasActiveSession() 偵測到 /tp-request session 就會 skip /tp-daily-check fire
// → daily-check 5/19 起連 4 天被擋（log: "Active session ... still running"）。
// Fix：每個 skill 有自己的 session prefix，hasActiveSession 接 skillFilter。
function sessionPrefixForSkill(skillCommand: string): string {
  // '/tp-request' → 'tripline-tp-request-'；'/tp-daily-check' → 'tripline-tp-daily-check-'
  // v2.33.49: validate through allowlist 保證 prefix 內無 shell metacharacter。
  const verified = assertAllowedSkill(skillCommand);
  const slug = verified.replace(/^\//, '').toLowerCase();
  return `tripline-${slug}-`;
}

// v2.33.110: cleanupOrphans 用「ALLOWED_SKILLS-derived prefix set」判斷哪些 tmux session
// 是本 server spawn 的 — 自動跟著新 skill 走免雙重維護，也不誤殺 user 手動的
// `tripline-debug` 等 ad-hoc session。Legacy `tripline-request-` 保留是 v2.33.27
// 前 spawn 的 session 過渡期可能還在跑（30min orphan timeout 內）。
// TODO(2026-06-08): v2.33.27 ship 已 2+ 週 + 多輪 Mac mini 重啟，legacy session 早被
// orphan timeout 清光。確認 prod `tmux ls` 0 個 `tripline-request-*` 後可刪 const +
// hasActiveSession line 185 backward-compat branch + api-server-per-skill-session.test.ts:33。
const LEGACY_SESSION_PREFIX = 'tripline-request-';
function getKnownSessionPrefixes(): string[] {
  return [
    ...Array.from(ALLOWED_SKILLS).map(sessionPrefixForSkill),
    LEGACY_SESSION_PREFIX,
  ];
}

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

// Phase 2 cron PATH 修：launchd PATH 不含 /opt/homebrew/bin，且 google-poi-refresh 舊
// hardcode /Users/ray/.bun/bin/bun 已不存在（bun 移到 homebrew）、auth-cleanup 用裸 'node'
// → 兩者 spawn ENOENT 沒在跑（api-server-stderr 2026-06-14/15）。仿 TMUX_BIN 偵測絕對路徑。
const resolveBin = (candidates: string[], fallback: string): string => {
  for (const p of candidates) {
    try { if (require('fs').existsSync(p)) return p; } catch {}
  }
  return fallback;
};
const NODE_BIN = resolveBin(['/opt/homebrew/bin/node', '/usr/local/bin/node'], 'node');
const BUN_BIN = resolveBin(['/opt/homebrew/bin/bun', '/Users/ray/.bun/bin/bun'], 'bun');

async function cleanupOrphans(maxAgeMs: number): Promise<number> {
  try {
    // v2.33.110: format 用 `|` delimiter 而非 space — tmux session name 允許空格，
    // space-split + `parts.length !== 2` 會 silent skip 含空格的 session（hasActiveSession
    // 仍 match → orphan 永不清 + cron 永真 skip，跟原 bug 同病灶）。tmux session name
    // 不允許 `|`（自 2017 起拒絕），用它當 delimiter 安全。
    const result = spawnSync(TMUX_BIN, ['ls', '-F', '#{session_name}|#{session_created}'], { encoding: 'utf-8' });
    // tmux ls exit 1 = no sessions exist — not an error
    if (result.status !== 0) return 0;
    const knownPrefixes = getKnownSessionPrefixes();
    const now = Math.floor(Date.now() / 1000);
    let killed = 0;
    for (const line of (result.stdout || '').split('\n')) {
      const parts = line.split('|');
      if (parts.length !== 2) continue;
      const [name, createdStr] = parts;
      if (!knownPrefixes.some(p => name.startsWith(p))) continue;
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

function hasActiveSession(skillCommand: string): string | null {
  // 同 skill 才會擋（不同 skill 可以平行跑，例：/tp-request 跑時 /tp-daily-check 不該被擋）。
  // v2.33.110: 參數改 required — 唯一 caller (processLoop) 必傳，原本三元 fallback
  // 從未 reach。同步刪 SESSION_PREFIX const（死碼）。
  const result = spawnSync(TMUX_BIN, ['ls', '-F', '#{session_name}'], { encoding: 'utf-8' });
  if (result.status !== 0) return null;
  const filter = sessionPrefixForSkill(skillCommand);
  for (const line of (result.stdout || '').split('\n')) {
    if (line.startsWith(filter)) return line;
    // v2.33.27 backward-compat：legacy LEGACY_SESSION_PREFIX 是 /tp-request 的 prefix；
    // 如果 caller 是 /tp-request 也要看到 legacy session（process restart 過渡期）。
    if (skillCommand === '/tp-request' && line.startsWith(LEGACY_SESSION_PREFIX)) return line;
  }
  return null;
}

// v2.55.52: tmux 副作用注入 ./lib/tmux-pane 的 orchestration（waitForRepl /
// submitSkillCommand），讓 incident 修正邏輯可 behavioral test。capture 失敗回 ''
// → readiness / submit poll 自然重試；sendKeys 吞 status（效果由後續 capture 驗證）。
const tmuxDeps: TmuxDeps = {
  capture: (s) => spawnSync(TMUX_BIN, ['capture-pane', '-t', s, '-p'], { encoding: 'utf-8' }).stdout || '',
  sendKeys: (s, keys) => { spawnSync(TMUX_BIN, ['send-keys', '-t', s, keys], { encoding: 'utf-8' }); },
  sleep,
  log,
};

/** POSIX shell single-quote escape for values injected into the inline `tmux new-session`
 *  env prefix. Security-sensitive (shell injection) — one definition so both the token and
 *  the restrict-trip value can't drift apart. */
function shSingleQuote(s: string): string {
  return s.replace(/'/g, `'\\''`);
}

async function spawnTmuxRequest(skillCommand: string): Promise<boolean> {
  // v2.33.49 round 8a: enforce allowlist at every entry point — defense in
  // depth (sessionPrefixForSkill also asserts but defensive double-gate).
  assertAllowedSkill(skillCommand);
  // v2.22.0：claude /tp-request skill 用 `Authorization: Bearer $TRIPLINE_API_TOKEN`
  // 寫入 prod API（含 §6/§7/§8/§9 poi-favorites 4 條 path）。.env.local 只有
  // TRIPLINE_API_CLIENT_ID/SECRET，沒 TOKEN — 必須 mint 後 inject 到 tmux session
  // env，否則 skill 內 curl header 是 `Bearer ` (empty) → middleware 401。
  // v2.55.54: /tp-request 啟用時取 user token（可寫行程）；否則 / 失敗 → service token。
  const acquired = await acquireToken(skillCommand);
  if (acquired === null) {
    return false; // acquireToken 已 logError（service token 也失敗）
  }
  const token = acquired.token;

  // v2.33.27: session name 含 skill slug，讓 hasActiveSession 區分。
  // 例：'tripline-tp-request-1779...' vs 'tripline-tp-daily-check-1779...'
  const sessionName = `${sessionPrefixForSkill(skillCommand)}${Date.now()}-${process.pid}`;
  const claudePath = '/Users/ray/.local/bin/claude';

  // shell-escape token for the inline env assignment（避免 token 包含特殊字元）
  const escapedToken = shSingleQuote(token);
  // v2.55.56: pass the restricted trip so the skill only drains THAT trip's requests
  // (the token can't write others anyway; this keeps it from 403-failing them). Empty
  // for the service-token fallback — skill drains normally.
  const restrictTripEnv = acquired.restrictTrip
    ? `TRIPLINE_RESTRICT_TRIP='${shSingleQuote(acquired.restrictTrip)}' `
    : '';

  // Detached tmux session — claude 跑 interactive REPL（無 -p）。透過 env var 把
  // TRIPLINE_API_TOKEN + session name 傳給 skill；skill 結尾用 TRIPLINE_TMUX_SESSION
  // 自殺。--name 給 claude session 一個顯示名稱（同 tmux session）方便人類辨識。
  //
  // PATH 含 homebrew dir — launchd 啟動的 api-server process.env.PATH 沒有
  // /opt/homebrew/bin，skill 內 `tmux kill-session` self-destruct 會 ENOENT silent
  // fail，session 變 stuck。`2>/dev/null || true` 在 skill 裡會吃掉錯誤。
  // 同時 export TMUX_BIN 讓 skill 有更穩的 escape hatch。
  const tmuxDir = TMUX_BIN.includes('/') ? TMUX_BIN.slice(0, TMUX_BIN.lastIndexOf('/')) : '';
  const augmentedPath = [process.env.PATH || '', '/Users/ray/.local/bin', tmuxDir]
    .filter(Boolean)
    .join(':');
  const create = spawnSync(TMUX_BIN, [
    'new-session', '-d', '-s', sessionName, '-c', PROJECT_DIR,
    `TRIPLINE_API_TOKEN='${escapedToken}' ${restrictTripEnv}TRIPLINE_TMUX_SESSION='${sessionName}' TMUX_BIN='${TMUX_BIN}' PATH='${augmentedPath}' ${claudePath} --dangerously-skip-permissions --name '${sessionName}'`
  ], { encoding: 'utf-8' });
  if (create.status !== 0) {
    logError(`tmux new-session failed (status=${create.status}): ${create.stderr || ''}`);
    return false;
  }

  // v2.55.52: 等 REPL 就緒（取代硬編碼 2.5s；boot 變慢會丟失早送的 skill command）。
  if (!(await waitForRepl(tmuxDeps, sessionName))) {
    logError(`claude REPL 未在時限內就緒，kill session: ${sessionName}`);
    spawnSync(TMUX_BIN, ['kill-session', '-t', sessionName]);
    return false;
  }

  // 送 skill command（type → poll 落地 → 單獨 Enter → poll 提交，防 slash autocomplete 吞 Enter）
  if (!(await submitSkillCommand(tmuxDeps, sessionName, skillCommand))) {
    logError(`skill command 未能提交，kill session: ${sessionName}`);
    spawnSync(TMUX_BIN, ['kill-session', '-t', sessionName]);
    return false;
  }

  // 2026-07-07 可觀測性：session 輸出 pipe 到持久 log — request #237 兩次
  // session 死掉（orphan 清除 / 中途結束）都因 tmux buffer 即逝無從驗屍。
  // pipe-pane 失敗不阻擋 spawn（best-effort）。
  try {
    const skillSlug = skillCommand.replace(/^\//, '').replace(/[^a-zA-Z0-9-]/g, '-');
    const sessionLogDir = join(PROJECT_DIR, 'scripts', 'logs', skillSlug);
    mkdirSync(sessionLogDir, { recursive: true });
    const pipe = spawnSync(TMUX_BIN, [
      // v2.55.54: sed-scrub `Bearer <token>` before the sink — a user access token
      // is owner-write; keep it out of the ~30d-retained plaintext session log even
      // if the REPL ever echoes the Authorization header.
      'pipe-pane', '-t', sessionName, '-o',
      `sed -E 's#[Bb]earer [A-Za-z0-9._~+/=-]+#Bearer <redacted>#g' >> '${join(sessionLogDir, `${sessionName}.log`)}'`,
    ], { encoding: 'utf-8' });
    if (pipe.status !== 0) logError(`tmux pipe-pane failed (non-blocking): ${pipe.stderr || ''}`);
  } catch (err) {
    logError(`session log pipe setup failed (non-blocking): ${err instanceof Error ? err.message : String(err)}`);
  }

  log(`Spawned tmux session: ${sessionName} (skill=${skillCommand}, fire-and-forget; skill self-destructs at end)`);
  return true;
}

// --- Process Loop ---
// v2.30.7: skill 自己 drain queue (查 status=processing/open/received → 依序處理)，
// API server 只負責「沒人在跑就 spawn 一隻」。多筆 stacked /trigger 期間若已有
// session 活著，後續 /trigger return early。
// v2.33.27: per-skill isRunning lock。原本 global boolean 讓不同 skill
// 同時 fire 互擋（/tp-request 跑時 /tp-daily-check 被卡 → 4 天沒 fire）。
const runningSkills = new Set<string>();
let lastProcessed: string | null = null;
let processedCount = 0;

async function processLoop(source: 'api' | 'job', skillCommand: string = '/tp-request'): Promise<boolean> {
  // v2.33.49 round 8a: allowlist gate also at processLoop entry.
  assertAllowedSkill(skillCommand);
  if (runningSkills.has(skillCommand)) {
    log(`processLoop: already running, skip (source=${source}, skill=${skillCommand})`);
    return false;
  }
  runningSkills.add(skillCommand);
  log(`Process loop started (source: ${source}, skill: ${skillCommand})`);

  try {
    // Cleanup orphans (>30min) — token TTL 是 1h，30min cleanup 保證 active session
    // 不會碰到 token expire
    const cleaned = await cleanupOrphans(ORPHAN_MAX_AGE_MS);
    if (cleaned > 0) log(`Cleaned ${cleaned} orphan session(s)`);

    // 只擋同 skill active session — 不同 skill 可平行跑（v2.33.27）
    const active = hasActiveSession(skillCommand);
    if (active) {
      log(`Active ${skillCommand} session ${active} still running, skip new spawn`);
      return false;
    }

    // Fire-and-forget tmux spawn — skill 內部 drain queue + 自殺
    const success = await spawnTmuxRequest(skillCommand);
    if (success) {
      lastProcessed = new Date().toISOString();
      processedCount++;
    }
    return success;
  } catch (err) {
    logError(`Process loop error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  } finally {
    runningSkills.delete(skillCommand);
    log(`Process loop ended (skill=${skillCommand})`);
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
  // v2.33.128 G2：mail send observability — 失敗 throttledAlert + 成功 healthy
  // recovery（key per template，避免 password-reset 失敗 alert 跟 invitation 混在一起）
  onSendResult: (result) => {
    const key = `mail-${result.template ?? 'unknown'}`;
    if (result.ok) {
      void throttledAlert(
        key,
        'healthy',
        `🛡️ Tripline mail (${result.template ?? '-'}) 恢復寄送`,
      );
    } else {
      void throttledAlert(
        key,
        'failed',
        `🚨 Tripline /internal/mail/send 失敗\n` +
          `template=${result.template ?? '-'} to=${result.to}\n` +
          `subject=${result.subject.slice(0, 80)}\n` +
          `error=${(result.error ?? 'unknown').slice(0, 200)}\n` +
          `→ user 可重新 trigger 該流程（如 /api/oauth/send-verification）重發`,
      );
    }
  },
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
        // v2.33.27: running 改報 array — backward-compat boolean 也保留
        running: runningSkills.size > 0,
        runningSkills: Array.from(runningSkills),
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

      // /trigger 預設跑 /tp-request；per-skill lock 只擋同 skill
      if (runningSkills.has('/tp-request')) {
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

// ── v2.31.3: 內建多 schedule cron（取代 Cowork） ─────────────────────────
//
// 歷史 context：v2.30.5 把 launchd schedulers 改進 Claude Desktop Cowork，
// 但 Cowork 後端 API 化 + scheduled-tasks.json 不能直接寫，且重啟會清空 →
// 觀察到 2026-05-07 起 cron 完全停跑，user-submitted chat 卡 open 至 11 天
// （v2.30.18 加 15-min 內部 cron band-aid）。
//
// v2.31.3 廢棄 Cowork、擴成 3 schedule 主路徑：
// - /tp-request   每 30 分鐘（兜底；CF Pages POST 是第一線即時 trigger）
// - /tp-daily-check 每天 09:00（每日健康報告 + 自動 fix）
// - /tp-poi-enrich-monthly 每天 08:00（skill 內 day-1 guard，不是 1 號 noop exit）
//
// 用 setInterval + setTimeout-to-next-occurrence chain，不引 cron parser dep。
// v2.33.27: 鎖改 per-skill — 不同 skill 不互擋。
function fireSchedule(skillCommand: string, label: string): void {
  if (runningSkills.has(skillCommand)) {
    log(`Skip ${label} schedule (already running, skill=${skillCommand})`);
    return;
  }
  processLoop('job', skillCommand).catch((err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    logError(`internal cron ${label} processLoop unhandled: ${errMsg}`);
    // v2.33.127 G8：對齊 /tp-request alertAdminTelegram pattern — 之前 /tp-daily-check
    // 跟其他 cron processLoop 失敗只 logError 不告警，silently 死掉
    void throttledAlert(
      `cron-${label}`,
      'failed',
      `🚨 Tripline api-server cron ${label} processLoop unhandled error\nskill=${skillCommand}\nerror: ${errMsg.slice(0, 200)}`,
    );
  });
}

// 排程到下一次每日固定時段（hour:minute），之後改 24h interval
function scheduleDaily(hour: number, minute: number, skillCommand: string, label: string): void {
  const { next, delayMs } = computeNextDailyFire(new Date(), hour, minute);
  log(`Scheduled ${label} (${skillCommand}) first fire at ${next.toISOString()} (in ${Math.round(delayMs / 60000)} min)`);
  setTimeout(() => {
    fireSchedule(skillCommand, label);
    setInterval(() => fireSchedule(skillCommand, label), 24 * 60 * 60 * 1000);
  }, delayMs);
}

// v2.31.96: 對外部 bash/bun script 的 fire-and-forget helper（不走 claude/tmux）
// 接 v2.31.3 launchd 廢棄後 orphan 的 daily scripts（refresh:google / auth-cleanup）。
// 不共用 isRunning 鎖 — 跑 script 不爭 tmux session，獨立走自己日誌。
async function fireScheduleScript(cmd: string, args: string[], label: string): Promise<void> {
  log(`Firing script: ${label} (${cmd} ${args.join(' ')})`);
  try {
    const { spawn } = await import('node:child_process');
    const { openSync } = await import('node:fs');
    const outFd = openSync(join(LOG_DIR, `script-${label}-${todayStr()}.log`), 'a');
    const errFd = openSync(join(LOG_DIR, `script-${label}-${todayStr()}.err`), 'a');
    const child = spawn(cmd, args, {
      cwd: PROJECT_DIR,
      detached: true,
      stdio: ['ignore', outFd, errFd],
    });
    child.on('error', (err) => {
      logError(`Script ${label} spawn error: ${err.message}`);
      void throttledAlert(
        `script-spawn-${label}`,
        'failed',
        `🚨 Tripline cron script ${label} spawn error\ncmd=${cmd} args=${args.join(' ')}\nerror: ${err.message.slice(0, 200)}`,
      );
    });
    // v2.33.127 G3：之前 detached spawn 完全不檢查 exit code → node ENOENT /
    // npm script crash 全 silent skip。listen exit + 非 0 alert（unref 後仍 fire，
    // bun 不 detach event loop）。
    child.on('exit', (code, signal) => {
      if (code === 0) {
        log(`Script ${label} exited cleanly (code=0)`);
        // 成功：throttledAlert 用 'healthy' state（若先前 failed 會發 recovery alert）
        void throttledAlert(
          `script-exit-${label}`,
          'healthy',
          `🛡️ Tripline cron script ${label} 恢復正常`,
        );
      } else {
        const reason = signal ? `signal=${signal}` : `code=${code}`;
        logError(`Script ${label} exited non-zero (${reason})`);
        void throttledAlert(
          `script-exit-${label}`,
          'failed',
          `🚨 Tripline cron script ${label} exit ${reason}\ncmd=${cmd} args=${args.join(' ')}\n` +
            `查 log：scripts/logs/script-${label}-${todayStr()}.{log,err}`,
        );
      }
    });
    child.unref();
  } catch (err) {
    logError(`fireScheduleScript ${label} setup failed: ${(err as Error).message}`);
    void throttledAlert(
      `script-setup-${label}`,
      'failed',
      `🚨 Tripline cron script ${label} setup failed\nerror: ${(err as Error).message}`,
    );
  }
}

function scheduleDailyScript(hour: number, minute: number, cmd: string, args: string[], label: string): void {
  const { next, delayMs } = computeNextDailyFire(new Date(), hour, minute);
  log(`Scheduled ${label} first fire at ${next.toISOString()} (in ${Math.round(delayMs / 60000)} min)`);
  setTimeout(() => {
    void fireScheduleScript(cmd, args, label);
    setInterval(() => void fireScheduleScript(cmd, args, label), 24 * 60 * 60 * 1000);
  }, delayMs);
}

// 10 分鐘 /tp-request 兜底（v2.31.5：30 min → 10 min，加快 CF Pages POST /trigger 失敗時的補救週期）
const REQUEST_CRON_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => fireSchedule('/tp-request', 'request-handler'), REQUEST_CRON_INTERVAL_MS);
log(`Scheduled request-handler (/tp-request) every ${REQUEST_CRON_INTERVAL_MS / 60000} min`);

// v2.31.97: 改 06:10（早於 4:00 auth-cleanup / 4:30 refresh:google 是不行的，
// daily-check 必須在它要稽核的 schedule 之後 — Ray 想早一點看每日報告但不能撞 cron）。
// 06:10 給 04:30 refresh 留 ~100 min 完成 50 POI × 1.5s sleep + Place Details
// API + 緩衝（實測 ~3-5 min，但保險）。
scheduleDaily(6, 10, '/tp-daily-check', 'daily-check');

// v2.31.96: 接 v2.31.3 launchd 廢棄後 orphan 的 3 個 daily script。
// 故事：v2.31.3 把 launchd com.tripline.daily-check 整批廢棄、改 api-server
// 內部 cron，但只搬 /tp-daily-check，其他 daily 任務沒人接 → 13 天沒跑。
//
// google-poi-refresh-30d 04:30 — 30 天滾動 refresh POI lifecycle (50 POI/day cap)。
//   沒跑：pois.status_checked_at 不更新、TripHealthBanner 看不到「永久結業」。
// auth-cleanup 04:00 — V2-P6 retention sweep（auth_audit_log + session_devices
//   + oauth_models 30 天）。沒跑：表會無限增長。
//
// /tp-poi-enrich-monthly 仍維持 v2.31.4 移除狀態（batch enrich 已被 即時
// POST /api/pois/:id/enrich + 30d refresh 取代）。
scheduleDailyScript(4, 0, NODE_BIN, ['scripts/auth-cleanup.js'], 'auth-cleanup');
scheduleDailyScript(4, 30, BUN_BIN, ['run', 'refresh:google'], 'google-poi-refresh');
// v2.33.131 G13: log retention sweep — scripts/logs/ 下 per-date files > 30d
// 刪除 + 超大單檔 truncate 保留 tail 50%。PR4 exit code wrapper 自動接 alert。
scheduleDailyScript(3, 30, 'zsh', ['scripts/log-rotate.sh'], 'log-rotate');
