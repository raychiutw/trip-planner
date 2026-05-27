/**
 * daily-check.js audit_log anomaly query — v2.33.132 PR9 G14
 *
 * Source-grep + threshold + status classification + report wiring。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '../../scripts/daily-check.js'),
  'utf8',
);

describe('queryAuditAnomaly — threshold 常數', () => {
  it('AUDIT_USER_MUTATION_WARNING = 200', () => {
    expect(SRC).toMatch(/AUDIT_USER_MUTATION_WARNING = 200/);
  });

  it('AUDIT_TRIP_MUTATION_WARNING = 100', () => {
    expect(SRC).toMatch(/AUDIT_TRIP_MUTATION_WARNING = 100/);
  });

  it('AUDIT_DELETE_CRITICAL = 10', () => {
    expect(SRC).toMatch(/AUDIT_DELETE_CRITICAL = 10/);
  });
});

describe('queryAuditAnomaly — 3 個 SQL query', () => {
  it('heavyUsers query: GROUP BY changed_by_user_id HAVING > AUDIT_USER_MUTATION_WARNING', () => {
    expect(SRC).toMatch(
      /SELECT changed_by_user_id AS userId, changed_by AS actor, COUNT\(\*\) AS mutations/,
    );
    expect(SRC).toMatch(/GROUP BY changed_by_user_id/);
    expect(SRC).toMatch(/HAVING COUNT\(\*\) > " \+ AUDIT_USER_MUTATION_WARNING/);
  });

  it('heavyTrips query: 排除 system trip_id + per trip 統計', () => {
    expect(SRC).toMatch(/trip_id != 'system'/);
    expect(SRC).toMatch(/GROUP BY trip_id/);
    expect(SRC).toMatch(/HAVING COUNT\(\*\) > " \+ AUDIT_TRIP_MUTATION_WARNING/);
  });

  it("criticalDeletes query: action='delete' + table IN ('trips','users')", () => {
    expect(SRC).toMatch(/action = 'delete'/);
    expect(SRC).toMatch(/table_name IN \('trips', 'users'\)/);
    expect(SRC).toMatch(/HAVING COUNT\(\*\) > " \+ AUDIT_DELETE_CRITICAL/);
  });

  it("所有 query 都用 datetime('now', '-1 day') 24h window", () => {
    expect(SRC).toMatch(/datetime\('now', '-1 day'\)/);
  });

  it('LIMIT 10 for heavyUsers/heavyTrips（避免報告爆量）', () => {
    expect(SRC).toMatch(/LIMIT 10/);
  });
});

describe('queryAuditAnomaly — status classification', () => {
  it('criticalDeletes > 0 → status=critical', () => {
    expect(SRC).toMatch(/if \(criticalDeletes\.length > 0\) \{\s+status = 'critical';/);
  });

  it('heavyUsers/heavyTrips > 0 → status=warning', () => {
    expect(SRC).toMatch(
      /} else if \(heavyUsers\.length > 0 \|\| heavyTrips\.length > 0\) \{\s+status = 'warning';/,
    );
  });

  it('return 含 thresholds 給報告顯示', () => {
    expect(SRC).toMatch(/thresholds: \{/);
    expect(SRC).toMatch(/userMutationWarning: AUDIT_USER_MUTATION_WARNING/);
    expect(SRC).toMatch(/tripMutationWarning: AUDIT_TRIP_MUTATION_WARNING/);
    expect(SRC).toMatch(/deleteCritical: AUDIT_DELETE_CRITICAL/);
  });
});

describe('main pipeline wiring', () => {
  it('Promise.allSettled idx 8 = queryAuditAnomaly()', () => {
    expect(SRC).toMatch(/queryAuditAnomaly\(\),\s+\/\/ 8 — v2\.33\.132 G14/);
  });

  it('val(8, ...) fallback shape 對齊（status/heavyUsers/heavyTrips/criticalDeletes）', () => {
    expect(SRC).toMatch(/var auditAnomaly = val\(8, \{ status: 'ok', heavyUsers: \[\], heavyTrips: \[\], criticalDeletes: \[\]/);
  });

  it('calcSummary signature 加 auditAnomaly 參數', () => {
    expect(SRC).toMatch(
      /function calcSummary\(sentry, apiErrors, npmAudit, requestErrors, schedulerErrors, dataHygiene, googleMapsQuota, auditAnomaly\)/,
    );
    expect(SRC).toMatch(
      /var sections = \[sentry, apiErrors, npmAudit, requestErrors, schedulerErrors, dataHygiene, googleMapsQuota, auditAnomaly\]/,
    );
  });

  it('report object 含 auditAnomaly field', () => {
    expect(SRC).toMatch(/auditAnomaly: auditAnomaly\s*\};/);
  });
});
