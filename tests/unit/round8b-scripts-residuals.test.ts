/**
 * round8b-scripts-residuals.test.ts — v2.33.50 round 8b scripts hardening
 *
 * Source-grep guard for HIGH/MED fixes:
 *  1. provision-admin-cli --rotate-secret cascade revoke oauth_access_tokens + oauth_refresh_tokens
 *  2. daily-report.js /api/trips 加 auth via getTriplineToken
 *  3. _lib/cron-shared.ts alertTelegram warn-on-missing + token format validate
 *  4. lib/d1-client.js 5xx retry + only-errors stringify (拔 request body leak)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PROVISION_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/provision-admin-cli-client.js'),
  'utf-8',
);
const DAILY_REPORT_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/daily-report.js'),
  'utf-8',
);
const CRON_SHARED_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/_lib/cron-shared.ts'),
  'utf-8',
);
const D1_CLIENT_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/lib/d1-client.js'),
  'utf-8',
);

describe('v2.33.50 round 8b — provision-admin-cli cascade revoke', () => {
  it('--rotate-secret 預設 cascade revoke access + refresh tokens', () => {
    expect(PROVISION_SRC).toContain('DELETE FROM oauth_access_tokens WHERE client_id = ?');
    expect(PROVISION_SRC).toContain('DELETE FROM oauth_refresh_tokens WHERE client_id = ?');
  });

  it('--keep-tokens opt-out flag 存在 (rare graceful rollover)', () => {
    expect(PROVISION_SRC).toContain("'--keep-tokens'");
    expect(PROVISION_SRC).toContain('keepTokens');
  });

  it('failure path 拋 warning (但 client 仍 issued)', () => {
    expect(PROVISION_SRC).toMatch(/failed to cascade-revoke tokens/);
  });
});

describe('v2.33.50 round 8b — daily-report.js auth on /api/trips', () => {
  it('import getTriplineToken from lib/get-tripline-token', () => {
    expect(DAILY_REPORT_SRC).toMatch(/getToken: getTriplineToken/);
    expect(DAILY_REPORT_SRC).toContain("require('./lib/get-tripline-token')");
  });

  it('checkLinks 開頭 mint token + Authorization header', () => {
    expect(DAILY_REPORT_SRC).toContain('await getTriplineToken()');
    expect(DAILY_REPORT_SRC).toContain("Authorization: 'Bearer '");
  });

  it('token mint failure → 跳過 checkLinks (不 crash)', () => {
    expect(DAILY_REPORT_SRC).toContain('token mint failed');
    expect(DAILY_REPORT_SRC).toContain('return [];');
  });

  it('/api/trips + /days fetch 都帶 authHeaders', () => {
    expect(DAILY_REPORT_SRC).toContain("/api/trips', { headers: authHeaders }");
    expect(DAILY_REPORT_SRC).toMatch(/\/days', \{ headers: authHeaders \}/);
  });
});

describe('v2.33.50 round 8b — cron-shared.ts alertTelegram defense', () => {
  it('missing env → console.warn once (not silent)', () => {
    expect(CRON_SHARED_SRC).toContain('_telegramEnvWarned');
    expect(CRON_SHARED_SRC).toContain('alerts disabled');
  });

  it('TOKEN format validate (同 send-telegram.sh)', () => {
    expect(CRON_SHARED_SRC).toMatch(/\^\[0-9\]\+:\[A-Za-z0-9_-\]\+\$/);
  });
});

describe('v2.33.50 round 8b — d1-client.js 5xx retry + safer error', () => {
  it('1 retry on 5xx with 500ms backoff', () => {
    expect(D1_CLIENT_SRC).toContain('for (let attempt = 0; attempt < 2; attempt++)');
    expect(D1_CLIENT_SRC).toContain("res.status < 500 || attempt > 0");
    expect(D1_CLIENT_SRC).toContain('setTimeout(r, 500)');
  });

  it('error stringify 只用 errors 不 fallback json (拔 SQL params leak)', () => {
    expect(D1_CLIENT_SRC).toContain("json.errors || 'unknown'");
    expect(D1_CLIENT_SRC).not.toContain('json.errors || json');
  });
});
