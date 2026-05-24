/**
 * round-14c-residuals.test.ts — v2.33.62 完成所有 deferred finding 的 source-grep guard
 *
 * 7 個 fix:
 *   1. /og/* cache TTL comment 加註 future immutable upgrade path
 *   2. CSP report-to header + report-uri-style endpoint placeholder
 *   3. migration 0071: audit_log + changed_by_user_id FK
 *   4. _auth_audit hashIp HMAC fallback + SESSION_IP_HASH_SECRET env
 *   5. recordAuthEvent 加 env optional param + 8 個 callsite migrate
 *   6. SW cacheWillUpdate plugin 防 cross-user PII
 *   7. preview-deploy origin policy gate (env.ENVIRONMENT === 'preview')
 *   8. _app_settings.ts typed helper
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf-8');

const HEADERS = read('public/_headers');
const MIG_0071 = read('migrations/0071_audit_log_user_id.sql');
const AUDIT_HELPER = read('functions/api/_auth_audit.ts');
const VITE_CONFIG = read('vite.config.ts');
const MIDDLEWARE = read('functions/api/_middleware.ts');
const ENV_TYPES = read('functions/api/_types.ts');
const APP_SETTINGS = read('functions/api/_app_settings.ts');
const FORGOT = read('functions/api/oauth/forgot-password.ts');
const TOKEN_API = read('functions/api/oauth/token.ts');

describe('v2.33.62 #1 — /og cache TTL doc', () => {
  it('加 future immutable upgrade path comment', () => {
    expect(HEADERS).toMatch(/immutable/);
    expect(HEADERS).toMatch(/max-age=31536000/);
  });
});

describe('v2.33.62 #2 — CSP report-to + Report-To header', () => {
  it('CSP 加 report-to csp-endpoint directive', () => {
    expect(HEADERS).toMatch(/report-to csp-endpoint/);
  });

  it('Report-To header 設 csp-endpoint group + Sentry pattern URL', () => {
    expect(HEADERS).toMatch(/Report-To:.*"group":"csp-endpoint"/);
    expect(HEADERS).toMatch(/ingest\.us\.sentry\.io/);
  });

  it('comment 含 DSN ↔ CSP endpoint mapping 公式（v2.33.81: 移除 dashboard 取 endpoint 指令）', () => {
    // v2.33.81 hardcode 真正 endpoint，comment 改寫成 DSN ↔ CSP URL pattern 公式
    expect(HEADERS).toMatch(/Sentry CSP/);
    expect(HEADERS).toMatch(/DSN/);
  });
});

describe('v2.33.62 #3 — migration 0071 audit_log FK', () => {
  it('audit_log_new 加 changed_by_user_id REFERENCES users', () => {
    expect(MIG_0071).toMatch(/changed_by_user_id TEXT REFERENCES users\(id\) ON DELETE SET NULL/);
  });

  it('保留 companion_failure_reason col (0050 補的)', () => {
    expect(MIG_0071).toMatch(/companion_failure_reason TEXT/);
  });

  it('backfill via LEFT JOIN users.email', () => {
    expect(MIG_0071).toMatch(/LEFT JOIN users u ON u\.email = a\.changed_by/);
  });

  it('新建 changed_by_user_id index', () => {
    expect(MIG_0071).toContain('CREATE INDEX idx_audit_user ON audit_log(changed_by_user_id)');
  });
});

describe('v2.33.62 #4 — _auth_audit hashIp HMAC fallback', () => {
  it('hashIp 加 HMAC path if env.SESSION_IP_HASH_SECRET', () => {
    expect(AUDIT_HELPER).toMatch(/async function hashIp/);
    expect(AUDIT_HELPER).toMatch(/env\.SESSION_IP_HASH_SECRET/);
    expect(AUDIT_HELPER).toMatch(/name: 'HMAC', hash: 'SHA-256'/);
  });

  it('fallback to sha256Base64 if secret missing (backward compat)', () => {
    expect(AUDIT_HELPER).toMatch(/return sha256Base64\(ip\)/);
  });

  it('Env type 加 SESSION_IP_HASH_SECRET? + ENVIRONMENT?', () => {
    expect(ENV_TYPES).toMatch(/SESSION_IP_HASH_SECRET\?: string/);
    expect(ENV_TYPES).toMatch(/ENVIRONMENT\?:.*'production'.*'preview'/);
  });
});

describe('v2.33.62 #5 — recordAuthEvent env param + callers migrated', () => {
  it('recordAuthEvent 加 env optional param', () => {
    expect(AUDIT_HELPER).toMatch(/env\?:\s*\{\s*SESSION_IP_HASH_SECRET\?: string \}/);
  });

  it('forgot-password caller 傳 context.env', () => {
    expect(FORGOT).toMatch(/recordAuthEvent\([\s\S]*?\}, context\.env\)/);
  });

  it('token.ts caller 傳 context.env', () => {
    expect(TOKEN_API).toMatch(/recordAuthEvent\([\s\S]*?\}, context\.env\)/);
  });
});

describe('v2.33.62 #6 — SW cacheWillUpdate plugin', () => {
  it('vite.config 加 cacheWillUpdate 防 cross-user PII', () => {
    expect(VITE_CONFIG).toMatch(/cacheWillUpdate: async/);
    expect(VITE_CONFIG).toMatch(/request\.headers\.get\('Cookie'\)/);
    expect(VITE_CONFIG).toMatch(/cc\.includes\('private'\)/);
  });
});

describe('v2.33.62 #7 — preview origin policy gate', () => {
  it('isAllowedOrigin 對 preview origin 加 env.ENVIRONMENT === preview gate', () => {
    expect(MIDDLEWARE).toMatch(/env\.ENVIRONMENT === 'preview'/);
    expect(MIDDLEWARE).toMatch(/\[a-f0-9\]\+\\\.trip-planner-dby\\\.pages\\\.dev/);
  });
});

describe('v2.33.62 #8 — _app_settings typed helper', () => {
  it('APP_SETTINGS_SCHEMA + parseAppSetting + serialiseAppSetting + getAppSetting', () => {
    expect(APP_SETTINGS).toMatch(/export const APP_SETTINGS_SCHEMA/);
    expect(APP_SETTINGS).toMatch(/export function parseAppSetting/);
    expect(APP_SETTINGS).toMatch(/export function serialiseAppSetting/);
    expect(APP_SETTINGS).toMatch(/export async function getAppSetting/);
  });

  it('boolean / integer / json / string 四種 type', () => {
    expect(APP_SETTINGS).toMatch(/'boolean' \| 'integer' \| 'string' \| 'json'/);
  });
});
