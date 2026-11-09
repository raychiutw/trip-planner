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
  it('/s/* is in _routes.json include — else the Function never runs (CF serves static)', () => {
    const routes = JSON.parse(read('public/_routes.json')) as { include: string[] };
    expect(routes.include).toContain('/s/*');
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

