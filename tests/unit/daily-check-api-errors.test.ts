/**
 * daily-check.js — API error query contract.
 *
 * （trip docs 404 那條已隨 trip_docs 退場移除，2026-07-29）
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DAILY_CHECK_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../scripts/daily-check.js'),
  'utf8',
);

describe('daily-check.js — API error filters', () => {
  it('ignores expected 401 / 403 / 429 auth and rate-limit statuses', () => {
    expect(DAILY_CHECK_SRC).toContain('status NOT IN (401, 403, 429)');
  });


  it('does not escalate expected /api/route "no drivable route" 502 (P11/T13 design)', () => {
    expect(DAILY_CHECK_SRC).toContain(
      "status = 502 AND path = '/api/route' AND error = 'MAPS_UPSTREAM_FAILED: Routes empty result'",
    );
  });

  it('only escalates non-5xx client errors after a small volume threshold', () => {
    expect(DAILY_CHECK_SRC).toContain('CLIENT_ERROR_WARNING_THRESHOLD');
    expect(DAILY_CHECK_SRC).toContain('total >= CLIENT_ERROR_WARNING_THRESHOLD');
  });
});
