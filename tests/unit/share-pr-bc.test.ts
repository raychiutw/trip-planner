/**
 * Share nice-to-haves PR-B (OG) + PR-C (hardening) — structural contracts.
 * B1 OG meta injection, C2 clone per-IP gate, C4 createdAt parseUtcDate, C1/C3 cron wiring.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('B1 — /s/:token OG meta injection', () => {
  const OG = read('functions/s/[token].ts');
  it('serves the SPA shell + injects og/twitter title+description via HTMLRewriter', () => {
    expect(OG).toMatch(/ASSETS\.fetch/);
    expect(OG).toMatch(/HTMLRewriter/);
    expect(OG).toMatch(/meta\[property="og:title"\]/);
    expect(OG).toMatch(/meta\[property="og:description"\]/);
    expect(OG).toMatch(/meta\[name="twitter:title"\]/);
  });
  it('falls back to the plain shell on invalid/revoked/expired/error (never 404s the page)', () => {
    expect(OG).toMatch(/resolveActiveShare/);
    expect(OG).toMatch(/if \(!ogTitle\) return shell/);
    expect(OG).toMatch(/catch \{[\s\S]*fall through/);
  });
  it('queries ONLY always-public fields (name/title/countries/dates/destinations) — no notes / owner PII', () => {
    expect(OG).toMatch(/SELECT name, title, countries FROM trips/);
    expect(OG).not.toMatch(/owner_user_id|email|trip_emergency|trip_reservations|trip_flights|trip_lodgings|trip_pretrip/);
  });
});

describe('C2 — clone per-IP pre-gate', () => {
  const CLONE = read('functions/api/share/[token]/clone.ts');
  const RL = read('functions/api/_rate_limit.ts');
  it('clone checks a per-IP bucket (CLONE_PER_IP) in addition to per-user', () => {
    expect(RL).toMatch(/CLONE_PER_IP:/);
    expect(CLONE).toMatch(/clone:ip:/);
    expect(CLONE).toMatch(/clientIp\(context\.request\)/);
    expect(CLONE).toMatch(/RATE_LIMITS\.CLONE_PER_IP/);
  });
});

describe('C4 — share card createdAt via parseUtcDate (no raw UTC slice)', () => {
  const MODAL = read('src/components/share/ShareLinkModal.tsx');
  it('uses parseUtcDate-backed fmtCreated, not a raw createdAt string slice', () => {
    expect(MODAL).toMatch(/import \{ parseUtcDate \}/);
    expect(MODAL).toMatch(/fmtCreated\(l\.createdAt\)/);
    expect(MODAL).not.toMatch(/createdAt \?\? ''\)\.slice/);
  });
});

describe('C1/C3 — cleanup SQL + daily cron wired', () => {
  it('cleanup SQL files exist + daily workflow runs both', () => {
    expect(existsSync(join(ROOT, 'scripts/cleanup-expired-shares.sql'))).toBe(true);
    expect(existsSync(join(ROOT, 'scripts/cleanup-orphan-cloned-trips.sql'))).toBe(true);
    const wf = read('.github/workflows/share-cleanup.yml');
    expect(wf).toMatch(/cleanup-expired-shares\.sql/);
    expect(wf).toMatch(/cleanup-orphan-cloned-trips\.sql/);
    expect(wf).toMatch(/cron: '17 3 \* \* \*'/); // daily
  });
  it('expired-shares delete is gated on expiry + 30-day grace (epoch ms), idempotent', () => {
    const sql = read('scripts/cleanup-expired-shares.sql');
    expect(sql).toMatch(/DELETE FROM trip_shares/);
    expect(sql).toMatch(/expires_at IS NOT NULL/);
    expect(sql).toMatch(/2592000/); // 30-day grace seconds
  });
  it('orphan-cloned delete uses NOT EXISTS (safe vs empty perms) + 1-day grace', () => {
    const sql = read('scripts/cleanup-orphan-cloned-trips.sql');
    expect(sql).toMatch(/data_source = 'cloned'/);
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM trip_permissions/);
    expect(sql).not.toMatch(/NOT IN \(/); // NOT EXISTS, never NOT IN (empty-set footgun)
    expect(sql).toMatch(/-1 day/);
  });
});
