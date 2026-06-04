/**
 * quota-estimate.ts + _gcp_monitoring.ts
 *
 * Root causes locked here (v2.46.x). The daily report's Google Maps 金額 每天忽高忽低:
 *   1. _gcp_monitoring.ts read env.GCP_SERVICE_ACCOUNT_KEY_JSON / GCP_PROJECT_ID, but
 *      prod secret + _types.ts Env use GOOGLE_CLOUD_SA_KEY / GOOGLE_CLOUD_PROJECT_ID.
 *      Name mismatch → always null → fell back to D1-proxy synthetic constants
 *      (directions=50, …) = fake $0.4433 floor.
 *   2. MTD was projected (dailyCost × dayOfMonth) so it swung / decreased day-over-day.
 *   3. The host→name map (GCP_API_TO_SERVICE) collapsed New Places API (all
 *      places.googleapis.com) into place_details. Replaced by grouping on the real
 *      consumed_api `method` resource label; the map is deleted.
 *
 * Fix: correct env names, query real month-to-date counts grouped by method, and —
 * per user direction — throw 502 MAPS_UPSTREAM_FAILED when GCP is unavailable
 * instead of fabricating numbers. The D1-proxy fallback is removed entirely.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../../functions/api/_auth', () => ({ requireAdmin: vi.fn() }));
vi.mock('../../functions/api/_gcp_monitoring', () => ({
  fetchMapsQuotaFromCloudMonitoring: vi.fn(),
}));

import { onRequestGet } from '../../functions/api/admin/quota-estimate';
import { fetchMapsQuotaFromCloudMonitoring } from '../../functions/api/_gcp_monitoring';

const GCP_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../functions/api/_gcp_monitoring.ts'),
  'utf8',
);
const ESTIMATE_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../functions/api/admin/quota-estimate.ts'),
  'utf8',
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeContext(): any {
  return { env: {}, request: new Request('https://x/api/admin/quota-estimate') };
}

describe('_gcp_monitoring — env name + grouping (root-cause regression locks)', () => {
  it('reads GOOGLE_CLOUD_SA_KEY / GOOGLE_CLOUD_PROJECT_ID (aligned with _types Env + prod secret)', () => {
    expect(GCP_SRC).toContain('env.GOOGLE_CLOUD_SA_KEY');
    expect(GCP_SRC).toContain('env.GOOGLE_CLOUD_PROJECT_ID');
  });

  it('does NOT read the phantom GCP_* env names', () => {
    expect(GCP_SRC).not.toContain('env.GCP_SERVICE_ACCOUNT_KEY_JSON');
    expect(GCP_SRC).not.toContain('env.GCP_PROJECT_ID');
  });

  it('queries a month-to-date window (month start), not a fixed 24h window', () => {
    expect(GCP_SRC).toMatch(/getUTCMonth\(\)/);
    expect(GCP_SRC).not.toMatch(/24 \* 60 \* 60 \* 1000/);
  });

  it('groups by the real consumed_api method label, with the host→name map deleted', () => {
    expect(GCP_SRC).toContain('resource.label."method"');
    expect(GCP_SRC).toMatch(/resource\?\.labels\?\.method/);
    // the lossy host→name map that collapsed New Places API is gone
    expect(GCP_SRC).not.toContain('GCP_API_TO_SERVICE');
  });

  it('returns null when no creds are present (caller will surface error)', async () => {
    const actual = await vi.importActual<typeof import('../../functions/api/_gcp_monitoring')>(
      '../../functions/api/_gcp_monitoring',
    );
    await expect(actual.fetchMapsQuotaFromCloudMonitoring({})).resolves.toBeNull();
  });
});

describe('_gcp_monitoring — transient retry (daily-check 502 root-cause lock)', () => {
  // 2026-06-05 daily-check: /api/admin/quota-estimate 502×2 同一秒。根因 — 單次
  // transient GCP 失敗（401 token race / 5xx）直接回 null → endpoint 502。原 401
  // 分支 invalidate cache「caller can retry」但無 retry 存在。鎖住 retry loop。
  it('wraps the monitoring fetch in a bounded retry loop', () => {
    expect(GCP_SRC).toContain('MAX_ATTEMPTS');
    expect(GCP_SRC).toMatch(/for \(let attempt = 1; attempt <= MAX_ATTEMPTS/);
  });

  it('retries once on transient upstream classes (401 token race or 5xx)', () => {
    expect(GCP_SRC).toMatch(/resp\.status === 401 \|\| resp\.status >= 500/);
  });

  it('fetches a fresh token inside the loop so the 401 retry re-signs', () => {
    // getAccessToken 必須在 retry loop 內呼叫（attempt 1 invalidate cache 後，
    // attempt 2 才會 re-sign 新 token）。loop 前不可再有一次 getAccessToken。
    const loopStart = GCP_SRC.indexOf('for (let attempt = 1; attempt <= MAX_ATTEMPTS');
    expect(loopStart).toBeGreaterThan(-1);
    expect(GCP_SRC.slice(loopStart)).toContain('await getAccessToken(account)');
    // 整支只有 loop 內那一次 getAccessToken 呼叫
    expect(GCP_SRC.match(/await getAccessToken\(account\)/g)).toHaveLength(1);
  });
});

describe('quota-estimate endpoint — GCP-or-error (no synthetic fallback)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws MAPS_UPSTREAM_FAILED (502) when GCP unavailable — never fabricates counts', async () => {
    (fetchMapsQuotaFromCloudMonitoring as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    // 對齊 route.ts/poi-search.ts：Google 上游失敗 throw AppError，middleware 轉 502。
    await expect(onRequestGet(makeContext())).rejects.toMatchObject({
      code: 'MAPS_UPSTREAM_FAILED',
      status: 502,
    });
  });

  it('passes through real per-method counts (no padding, no source field)', async () => {
    (fetchMapsQuotaFromCloudMonitoring as ReturnType<typeof vi.fn>).mockResolvedValue([
      { method: 'google.maps.places.v1.Places.SearchText', count: 384 },
      { method: 'google.maps.routing.v2.Routes.ComputeRoutes', count: 4813 },
    ]);
    const res = await onRequestGet(makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2); // passthrough — NOT padded to a fixed 6-service list
    const search = body.find(
      (s: { method: string }) => s.method === 'google.maps.places.v1.Places.SearchText',
    );
    expect(search.count).toBe(384);
    expect(search.source).toBeUndefined(); // dead 'source' field dropped
  });

  it('source no longer contains the D1-proxy synthetic constants', () => {
    expect(ESTIMATE_SRC).not.toContain('estimateFromD1Proxy');
    expect(ESTIMATE_SRC).not.toContain("'d1-proxy'");
    // old placeholder constants (directions=50, maps_js=20, geocoding=5, autocomplete=10)
    expect(ESTIMATE_SRC).not.toMatch(/count(_24h)?:\s*(50|20|10)\b/);
  });
});
