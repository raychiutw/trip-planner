/**
 * GET /api/admin/quota-estimate
 *
 * Returns 24h Google Maps API request counts per service. Used by
 * scripts/google-quota-monitor.ts to estimate MTD spend.
 *
 * v2.33.107 #4: Ground-truth from Google Cloud Monitoring API
 * (`serviceruntime.googleapis.com/api/request_count`, grouped by `consumed_api`
 * label). 若 GCP service account env (GCP_SERVICE_ACCOUNT_KEY_JSON +
 * optional GCP_PROJECT_ID) 未設定 / API 失敗 → fallback 到 D1 proxy 估算
 * (cache hits + status checks + placeholder constants)，保證 endpoint 不會
 * 因 GCP 設定缺漏 down。
 *
 * Auth: admin only.
 *
 * Response: Array<{ service: string, count_24h: number, source: 'gcp' | 'd1-proxy' }>
 *   Services: search_text / place_details / directions / maps_js / geocoding / autocomplete
 */

import { requireAdmin } from '../_auth';
import { fetchMapsQuotaFromCloudMonitoring } from '../_gcp_monitoring';
import type { Env } from '../_types';

interface ServiceCount {
  service: string;
  count_24h: number;
  source: 'gcp' | 'd1-proxy';
}

/** D1 proxy estimation — fallback path when Cloud Monitoring unreachable. */
async function estimateFromD1Proxy(db: Env['DB']): Promise<ServiceCount[]> {
  // Search Text: count cache misses fetched in last 24h (cache HIT vs MISS proxy).
  const search = await db.prepare(
    `SELECT COUNT(*) AS n FROM pois_search_cache
     WHERE fetched_at > datetime('now', '-1 day')`,
  ).first<{ n: number }>();

  // Place Details: count POIs whose status_checked_at is within 24h
  const details = await db.prepare(
    `SELECT COUNT(*) AS n FROM pois
     WHERE status_checked_at IS NOT NULL
       AND status_checked_at > datetime('now', '-1 day')`,
  ).first<{ n: number }>();

  // Directions / Maps JS / Geocoding / Autocomplete — no D1 trace yet.
  // Rough scale-based placeholders（typical 50-100 trip views/day）。
  return [
    { service: 'search_text', count_24h: search?.n || 0, source: 'd1-proxy' },
    { service: 'place_details', count_24h: details?.n || 0, source: 'd1-proxy' },
    { service: 'directions', count_24h: 50, source: 'd1-proxy' },
    { service: 'maps_js', count_24h: 20, source: 'd1-proxy' },
    { service: 'geocoding', count_24h: 5, source: 'd1-proxy' },
    { service: 'autocomplete', count_24h: 10, source: 'd1-proxy' },
  ];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  requireAdmin(context);

  // 先試 Cloud Monitoring（ground truth）。env 缺失 / 失敗回 null → fallback。
  const gcpCounts = await fetchMapsQuotaFromCloudMonitoring(
    context.env as { GCP_SERVICE_ACCOUNT_KEY_JSON?: string; GCP_PROJECT_ID?: string },
  );

  let results: ServiceCount[];
  if (gcpCounts && gcpCounts.length > 0) {
    // Merge GCP counts with full service list — 沒回的 service 補 0（避免 caller
    // 用 indexOf 找不到 service crash）。GCP returns only services with traffic.
    const gcpMap = new Map(gcpCounts.map((c) => [c.service, c.count_24h]));
    const ALL_SERVICES = [
      'search_text',
      'place_details',
      'directions',
      'maps_js',
      'geocoding',
      'autocomplete',
    ] as const;
    results = ALL_SERVICES.map((service) => ({
      service,
      count_24h: gcpMap.get(service) ?? 0,
      source: 'gcp',
    }));
  } else {
    results = await estimateFromD1Proxy(context.env.DB);
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
