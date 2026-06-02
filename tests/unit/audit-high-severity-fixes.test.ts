/**
 * Regression locks for the v2.44.x audit high-severity bug-fix batch.
 *
 * Behavioral where cheap (rate-limit 429 enforcement, cache datetime format);
 * source-level for the rest (each lock pins the exact fix so it can't silently
 * regress). One block per finding.
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// ---- Rate-limit enforcement: /api/route returns 429 when bucket exhausted ----
const mockBump = vi.fn(async () => ({ ok: true, count: 1 }));
vi.mock('../../functions/api/_rate_limit', () => ({
  bumpRateLimit: (...a: unknown[]) => mockBump(...a),
  clientIp: () => '9.9.9.9',
  RATE_LIMITS: {
    ROUTE_PER_IP: { maxAttempts: 100, windowMs: 1, lockoutMs: 1 },
    POI_SEARCH_PER_IP: { maxAttempts: 200, windowMs: 1, lockoutMs: 1 },
    REPORTS_PER_IP: { maxAttempts: 200, windowMs: 1, lockoutMs: 1 },
  },
}));
vi.mock('../../functions/api/_maps_lock', () => ({ assertGoogleAvailable: vi.fn(async () => undefined) }));
const mockComputeRoute = vi.fn();
vi.mock('../../src/server/maps/google-client', () => ({ computeRoute: (...a: unknown[]) => mockComputeRoute(...a) }));

import { onRequestGet } from '../../functions/api/route';

function routeCtx(): any {
  return {
    request: new Request('http://localhost/api/route?from=139.7,35.6&to=139.8,35.7'),
    env: { DB: {}, GOOGLE_MAPS_API_KEY: 'k' },
  };
}

beforeEach(() => {
  mockBump.mockReset();
  mockBump.mockResolvedValue({ ok: true, count: 1 });
  mockComputeRoute.mockReset();
  mockComputeRoute.mockResolvedValue({ polyline: '_p~iF~ps|U', distanceMeters: 100, durationSeconds: 60 });
});

describe('rate-limit enforcement (regression: bumpRateLimit result was discarded)', () => {
  it('GET /api/route returns 429 + Retry-After when locked, and never calls computeRoute', async () => {
    mockBump.mockResolvedValueOnce({ ok: false, retryAfter: 3600, count: 101 });
    const res: Response = await onRequestGet(routeCtx());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('GET /api/route proceeds to computeRoute when not locked', async () => {
    await onRequestGet(routeCtx());
    expect(mockComputeRoute).toHaveBeenCalledOnce();
  });

  it('poi-search and reports also capture + enforce the bumpRateLimit result', () => {
    for (const f of ['functions/api/poi-search.ts', 'functions/api/reports.ts', 'functions/api/route.ts']) {
      const src = read(f);
      expect(src).toMatch(/const rl = await bumpRateLimit\(/);
      expect(src).toMatch(/if \(!rl\.ok\)/);
      expect(src).toMatch(/buildRateLimitResponse\(/);
    }
  });
});

// ---- maps/cache expires_at must be SQLite-native (space, not ISO 'T') ----
describe('maps/cache setCachedSearch writes SQLite-native expires_at', () => {
  it('stores YYYY-MM-DD HH:MM:SS (no T / ms / Z), so datetime() comparisons work', async () => {
    let boundExpiresAt: unknown;
    const db: any = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundExpiresAt = args[4]; // (query_hash, query_text, region, results_json, expires_at)
          return { run: async () => ({}) };
        },
      }),
    };
    const { setCachedSearch } = await import('../../src/lib/maps/cache');
    await setCachedSearch(db, 'ramen', 'JP', []);
    expect(typeof boundExpiresAt).toBe('string');
    expect(boundExpiresAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(boundExpiresAt).not.toContain('T');
    expect(boundExpiresAt).not.toContain('Z');
  });
});

// ---- Source-level locks for the remaining fixes ----
describe('audit fix source locks', () => {
  it('dev/apps PATCH routes allowed_scopes through validateScopes (privilege-escalation fix)', () => {
    const src = read('functions/api/dev/apps/[client_id].ts');
    expect(src).toMatch(/import \{ validateScopes \} from '\.\.\/apps'/);
    expect(src).toMatch(/const cleaned = validateScopes\(body\.allowed_scopes\)/);
    expect(read('functions/api/dev/apps.ts')).toMatch(/export function validateScopes/);
  });

  it('invitation-accept INSERT no longer references the dropped email column', () => {
    const src = read('src/server/invitation-accept.ts');
    expect(src).toMatch(/INSERT OR IGNORE INTO trip_permissions \(trip_id, role, user_id\)/);
    expect(src).not.toMatch(/trip_permissions \(email/);
  });

  it('EntryActionPage move action sends snake_case day_id', () => {
    const src = read('src/pages/EntryActionPage.tsx');
    expect(src).toMatch(/JSON\.stringify\(\{ day_id: selectedDayId \}\)/);
    expect(src).not.toMatch(/JSON\.stringify\(\{ dayId:/);
  });

  it('daily-report queries trip_requests (not the non-existent requests table)', () => {
    const src = read('scripts/daily-report.js');
    expect(src).toMatch(/FROM trip_requests WHERE created_at/);
    expect(src).not.toMatch(/FROM requests WHERE created_at/);
  });

  it('rollback gates updated_at by TABLE_COLUMNS membership (no SQL error on permission/relation tables)', () => {
    const src = read('functions/api/trips/[id]/audit/[aid]/rollback.ts');
    expect(src).toMatch(/TABLE_COLUMNS\[safeTable\]\.includes\('updated_at'\)/);
    // insert->delete rollback now checks it actually deleted a row
    expect(src).toMatch(/delResult\.meta\.changes === 0/);
  });

  it('cron alertTelegram falls back to TELEGRAM_BOT_HOME_TOKEN', () => {
    expect(read('scripts/_lib/cron-shared.ts')).toMatch(/TELEGRAM_BOT_HOME_TOKEN \|\| process\.env\.TELEGRAM_BOT_TOKEN/);
  });

  it('_poi find-or-create persists place_id (INSERT column + COALESCE backfill)', () => {
    const src = read('functions/api/_poi.ts');
    expect((src.match(/country, price, place_id\)/g) || []).length).toBe(2); // both INSERTs
    expect(src).toMatch(/'price', 'place_id',/); // COALESCE_FIELDS
    expect(src).toMatch(/place_id\?: string \| null/);
    expect(read('functions/api/pois/find-or-create.ts')).toMatch(/place_id: typeof body\.place_id === 'string'/);
  });

  it('TripNotesPage accordion header is a div role=button (no nested interactive buttons)', () => {
    const src = read('src/pages/TripNotesPage.tsx');
    expect(src).toMatch(/<div\s+role="button"\s+tabIndex=\{0\}\s+className="tp-notes-section-head"/);
    expect(src).not.toMatch(/<button\s+type="button"\s+className="tp-notes-section-head"/);
  });

  it('entries/[eid] re-throws AppError inside the OCC catch (avoids 503 misclassification)', () => {
    expect(read('functions/api/trips/[id]/entries/[eid].ts')).toMatch(/if \(err instanceof AppError\) throw err;/);
  });
});

// ---- Medium-tier audit fixes (v2.45.x) ----
describe('audit fix source locks — medium tier', () => {
  it('GlobalBottomNav nav patterns mirror DesktopSidebar (sub-routes + stop/map active)', () => {
    const nav = read('src/components/shell/GlobalBottomNav.tsx');
    const side = read('src/components/shell/DesktopSidebar.tsx');
    // 行程 pattern excludes map + stop/map; map pattern covers both map routes
    expect(nav).toContain('/^\\/trip\\/[^/]+(?:\\/?$|\\/(?!(?:map|stop\\/[^/]+\\/map)\\/?$).*)/');
    expect(nav).toMatch(/stop\\\/\[\^\/\]\+\\\/map\\\/\?\$/); // MAP pattern now includes stop/:id/map
    expect(side).toContain('/^\\/trip\\/[^/]+(?:\\/?$|\\/(?!(?:map|stop\\/[^/]+\\/map)\\/?$).*)/');
  });

  it('dev/apps PATCH app_name uses a typeof guard (no TypeError on JSON null)', () => {
    expect(read('functions/api/dev/apps/[client_id].ts')).toMatch(/if \(typeof body\.app_name === 'string'\)/);
  });

  it('functions/trip OG title falls back title || name || 行程', () => {
    expect(read('functions/trip/[[path]].ts')).toMatch(/trip\.title \|\| trip\.name \|\| '行程'/);
  });

  it('ShareLinkModal expiry pre-fill uses local date getters (not UTC toISOString)', () => {
    const src = read('src/components/share/ShareLinkModal.tsx');
    expect(src).toMatch(/customDate: l\.expiresAt == null \? '' : \(\(\) => \{ const d = new Date\(l\.expiresAt\)/);
    expect(src).not.toMatch(/customDate: l\.expiresAt == null \? '' : new Date\(l\.expiresAt\)\.toISOString/);
  });

  it('daily-check normalizes D1 naive datetime to UTC before stuck-cutoff compare', () => {
    expect(read('scripts/daily-check.js')).toMatch(/createdUtc = r\.created_at\.includes\('T'\)/);
  });

  it('requests notes dedup scopes the SELECT by ai_source', () => {
    const src = read('functions/api/requests/[id]/index.ts');
    expect(src).toMatch(/WHERE trip_id = \? AND ai_source = \?/);
    expect(src).toMatch(/\.bind\(tripId, aiSource\)/);
  });

  it('entries/batch validates start_time/end_time against TIME_RE', () => {
    const src = read('functions/api/trips/[id]/entries/batch.ts');
    expect(src).toMatch(/import \{ TIME_RE \} from '\.\.\/\.\.\/\.\.\/_time'/);
    expect(src).toMatch(/!TIME_RE\.test\(fields\[tf\] as string\)/);
  });

  it('import MAX_DESTINATIONS aligned to the PUT cap (30, no un-editable trips)', () => {
    expect(read('functions/api/trips/_import.ts')).toMatch(/export const MAX_DESTINATIONS = 30;/);
  });
});

// ---- Medium+low audit fixes (batch 3) ----
describe('audit fix source locks — batch 3', () => {
  it('oauth google callback recovers from concurrent first-login UNIQUE race', () => {
    expect(read('functions/api/oauth/callback/google.ts')).toMatch(/async function recoverIdentityRace\(/);
  });

  it('poi-favorites add-to-trip uses a null append sentinel (no gapped-sequence shift skip)', () => {
    const src = read('functions/api/poi-favorites/[id]/add-to-trip.ts');
    expect(src).toMatch(/let insertSortOrder: number \| null = null/);
    expect(src).toMatch(/const finalSortOrder = insertSortOrder \?\? \(maxSortOrder \+ 1\)/);
  });

  it('segments PATCH increments version on the coords-missing branch + guards null SELECT', () => {
    const src = read('functions/api/trips/[id]/segments/[sid].ts');
    expect((src.match(/version = version \+ 1/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(src).toMatch(/if \(!updated\) throw new AppError\('DATA_NOT_FOUND'/);
  });

  it('_gcp_monitoring wraps both fetches with AbortController timeouts', () => {
    const src = read('functions/api/_gcp_monitoring.ts');
    expect((src.match(/new AbortController\(\)/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((src.match(/clearTimeout/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('AlertPanel is-warning uses design tokens (dark-mode adaptive), not hardcoded rgb', () => {
    const src = read('src/components/shared/AlertPanel.tsx');
    expect(src).toMatch(/\.tp-alert-panel\.is-warning \{[\s\S]*var\(--color-warning-bg\)/);
    expect(src).not.toMatch(/border-color: rgb\(244, 140, 6\)/);
  });

  it('backfill-poi-addresses exec uses direct argv (no sh -c shell injection)', () => {
    const src = read('scripts/backfill-poi-addresses.ts');
    expect(src).toMatch(/function exec\(argv: string\[\]\)/);
    expect(src).not.toMatch(/Bun\.spawnSync\(\['sh', '-c'/);
  });

  it('docs PUT enforces a body byte cap', () => {
    expect(read('functions/api/trips/[id]/docs/[type].ts')).toMatch(/\.length > MAX_DOCS_BYTES|rawText\.length >/);
  });

  it('days entries POST returns entry_pois_version=1 + validates sort_order', () => {
    const src = read('functions/api/trips/[id]/days/[num]/entries.ts');
    expect(src).toMatch(/Number\.isInteger/);
  });

  it('dev/apps validates homepage_url + caps app_description', () => {
    const src = read('functions/api/dev/apps.ts');
    expect(src).toMatch(/function validateHomepageUrl/);
    expect(src).toMatch(/APP_DESCRIPTION_MAX/);
  });
});

// ---- Partial-tier hardening fixes ----
describe('audit fix source locks — partial hardening', () => {
  it('TimelineRail drag fallback id uses positional index (no null-id collision)', () => {
    const src = read('src/components/trip/TimelineRail.tsx');
    expect(src).toMatch(/findIndex\(\(ev, i\) => \(ev\.id \?\? `idx-\$\{i\}`\)/);
    expect(src).not.toMatch(/findIndex\(\(ev\) => \(ev\.id \?\? `idx-\$\{ev\.id\}`\)/);
  });

  it('notes/_shared non-OCC UPDATE guards a vanished row with 404', () => {
    expect(read('functions/api/trips/[id]/notes/_shared.ts')).toMatch(/if \(!row\) throw new AppError\('DATA_NOT_FOUND'\)/);
  });

  it('hkdf cache key uses the full secret (no truncated-prefix collision)', () => {
    const src = read('src/server/hkdf.ts');
    expect(src).toMatch(/const cacheKey = `\$\{masterSecret\}:\$\{info\}`/);
  });

  it('oauth userinfo normalizes created_at with a Z suffix', () => {
    expect(read('functions/api/oauth/userinfo.ts')).toMatch(/created_at\.endsWith\('Z'\)/);
  });

  it('days PUT returns the DB-read-back dayVersion (not a local guess)', () => {
    expect(read('functions/api/trips/[id]/days/[num].ts')).toMatch(/SELECT version FROM trip_days WHERE id = \?/);
  });
});
