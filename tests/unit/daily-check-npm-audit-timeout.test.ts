/**
 * daily-check-npm-audit-timeout.test.ts — v2.57.89
 *
 * Source-grep guard：npm audit 的 execSync timeout 不得低於 180s。
 * registry bulk advisories endpoint 實測單次 ~50s，60s 貼邊跑會週期性 ETIMEDOUT
 * 讓 daily-check 假 critical（2026-09-04、2026-09-18 兩次）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DAILY_CHECK_SRC = readFileSync(
  path.resolve(__dirname, '../../scripts/daily-check.js'),
  'utf-8',
);

describe('v2.57.89 — daily-check.js npm audit timeout', () => {
  it('npm audit execSync timeout ≥ 180000ms', () => {
    const fnSrc = DAILY_CHECK_SRC.slice(
      DAILY_CHECK_SRC.indexOf('function queryNpmAudit()'),
      DAILY_CHECK_SRC.indexOf('function queryRequestErrors'),
    );
    // 剝註解再抓，避免註解裡的數字造成假綠
    const stripped = fnSrc.replace(/\/\/.*$/gm, '');
    const m = stripped.match(/timeout:\s*(\d+)/);
    expect(m, 'queryNpmAudit 內找不到 timeout 設定').not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(180000);
  });
});
