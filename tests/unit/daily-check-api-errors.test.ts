/**
 * daily-check.js — API error query contract.
 *
 * Optional trip docs are allowed to 404. useTrip already treats
 * DATA_NOT_FOUND docs as a silent optional sub-resource, so daily-check should
 * not escalate those expected misses as post-ship anomalies.
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

  it('does not count optional trip docs 404 as API anomalies', () => {
    expect(DAILY_CHECK_SRC).toContain("status = 404 AND path LIKE '/api/trips/%/docs/%'");
  });

  it('only escalates non-5xx client errors after a small volume threshold', () => {
    expect(DAILY_CHECK_SRC).toContain('CLIENT_ERROR_WARNING_THRESHOLD');
    expect(DAILY_CHECK_SRC).toContain('total >= CLIENT_ERROR_WARNING_THRESHOLD');
  });
});
