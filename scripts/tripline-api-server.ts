#!/usr/bin/env bun
/**
 * Tripline API Server — Mac Mini 上的內部 mail relay 服務
 *
 * v2.30.6 Cowork migration 後僅保留 `/internal/mail/send`（OAuth password reset
 * 寄信走這條 → Gmail SMTP）+ `/health`。舊 `/trigger?source=api|job` 觸發
 * `claude -p /tp-request` 處理迴圈已隨 schedulers→Cowork migration 廢除，
 * trip request 處理改由 Cowork Hourly `/tp-request` skill poll D1 直接做。
 *
 * Endpoints:
 *   POST /internal/mail/send  — Pages Functions 寄 OAuth password reset email
 *   GET  /health              — 健康檢查
 */

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

// --- HTTP Server ---
/**
 * Constant-time Bearer token comparison — defends against timing side-channel
 * brute-force attacks now that /internal/mail/send is publicly reachable via
 * Tailscale Funnel (--https=8443) without per-IP rate limits (Q12).
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
        uptime: process.uptime(),
      });
    }

    if (url.pathname === '/internal/mail/send' && req.method === 'POST') {
      return await mailHandler(req);
    }

    return Response.json({ error: 'not found' }, { status: 404 });
  },
});

log(`Tripline API Server listening on port ${PORT}`);
