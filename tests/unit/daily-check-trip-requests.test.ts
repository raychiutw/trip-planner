/**
 * daily-check.js — trip_requests query schema contract.
 *
 * Migration 0049 (v2.21.3) DROP `trip_requests.mode`. Any stale SELECT
 * referencing that column triggers a D1 400, which Promise.allSettled silently
 * swallows into a fallback `{ status: 'ok', total: 0 }` — making the scheduler
 * report falsely green.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DAILY_CHECK_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../scripts/daily-check.js'),
  'utf8',
);

describe('daily-check.js — trip_requests query schema', () => {
  it('does not SELECT mode column (DROPPED in migration 0049)', () => {
    const fn = DAILY_CHECK_SRC.match(
      /async function queryRequestErrors\(\)[\s\S]+?\n\}\n/,
    )?.[0];
    expect(fn, 'queryRequestErrors function not found').toBeTruthy();
    expect(fn).not.toMatch(/\bmode\b/);
  });

  it('does not surface mode in pending request mapping', () => {
    expect(DAILY_CHECK_SRC).not.toMatch(/mode:\s*r\.mode/);
  });
});
