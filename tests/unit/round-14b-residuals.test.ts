/**
 * round-14b-residuals.test.ts — v2.33.61 Round 14 residuals guard
 *
 * Source-grep:
 *   1. package.json overrides pin 3 HIGH CVE
 *   2. auth-cleanup.js api_logs retention sweep
 *   3. daily-report.js api_logs sweep moved away
 *   4. .tp-rail-line CSS rule removed
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf-8');

const PACKAGE_JSON = JSON.parse(read('package.json'));
const AUTH_CLEANUP = read('scripts/auth-cleanup.js');
const DAILY_REPORT = read('scripts/daily-report.js');
const TOKENS_CSS = read('css/tokens.css');

describe('v2.33.61 #1 — npm overrides pin 3 HIGH CVE', () => {
  it('overrides 區塊存在', () => {
    expect(PACKAGE_JSON.overrides).toBeDefined();
  });

  it('@babel/plugin-transform-modules-systemjs 鎖 7.29.4+ (RCE CVSS 8.2)', () => {
    expect(PACKAGE_JSON.overrides['@babel/plugin-transform-modules-systemjs']).toMatch(/\^7\.29\./);
  });

  it('serialize-javascript 鎖 7.0.5+ (RCE CVSS 8.1)', () => {
    expect(PACKAGE_JSON.overrides['serialize-javascript']).toMatch(/\^7\.0\./);
  });

  it('fast-uri 鎖 3.1.2+ (path traversal CVSS 7.5)', () => {
    expect(PACKAGE_JSON.overrides['fast-uri']).toMatch(/\^3\.1\./);
  });
});

describe('v2.33.61 #2 — auth-cleanup.js api_logs retention sweep', () => {
  it('api_logs 60 天 sweep (從 daily-report 挪過來)', () => {
    expect(AUTH_CLEANUP).toMatch(/api_logs WHERE created_at < datetime\('now', '-60 days'\)/);
  });

  it('report 結構含 api_logs 欄', () => {
    expect(AUTH_CLEANUP).toContain('api_logs: 0');
  });
});

describe('v2.33.61 #3 — daily-report.js api_logs sweep no-op', () => {
  it('cleanupOldLogs 改 no-op (auth-cleanup 接手)', () => {
    expect(DAILY_REPORT).not.toMatch(/await queryD1\("DELETE FROM api_logs/);
    expect(DAILY_REPORT).toContain('No-op');
    expect(DAILY_REPORT).toContain('auth-cleanup.js');
  });
});

describe('v2.33.61 #4 — .tp-rail-line dead code 拔', () => {
  it('CSS rule 不再有 .tp-rail-line { display: none } 殼', () => {
    expect(TOKENS_CSS).not.toMatch(/\.tp-rail-line\s*\{\s*display:\s*none/);
  });

  it('CSS rule 不再有 .tp-rail-line { left: 96px }', () => {
    expect(TOKENS_CSS).not.toMatch(/\.tp-rail-line\s*\{\s*left:\s*96px/);
  });
});
