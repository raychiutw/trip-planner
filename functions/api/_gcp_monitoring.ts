/**
 * _gcp_monitoring.ts — Google Cloud Monitoring API client (Workers-compatible)
 *
 * 取代 `quota-estimate.ts` 原本的 D1 proxy 估算（local cache miss + api_logs
 * 推斷）為 ground-truth Maps Platform request count，透過 Cloud Monitoring
 * `timeSeries.list` 抓 `serviceruntime.googleapis.com/api/request_count` 並
 * 依 `consumed_api` label 分組。
 *
 * Auth flow (service account):
 *   1. Parse `GCP_SERVICE_ACCOUNT_KEY_JSON` env (Google service-account JSON)
 *   2. Sign JWT (RS256) with scope=monitoring.read, aud=oauth2 token endpoint
 *   3. POST jwt-bearer grant → exchange for access_token (1h TTL)
 *   4. Cache access_token in-isolate (50min)
 *   5. GET monitoring.googleapis.com/v3/projects/:id/timeSeries with Bearer
 *
 * Graceful fallback：env 缺失 / parse fail / GCP 5xx / token expired retry fail
 * → 整個 function 回 null，caller 退到 D1 proxy。
 *
 * Required env:
 *   - GCP_SERVICE_ACCOUNT_KEY_JSON: full service-account JSON 字串
 *   - GCP_PROJECT_ID: 目標 GCP project id（含 Maps Platform 計費）
 */
import { signJwt, importPrivateKey } from '../../src/server/jwt';
import type { JwtClaims } from '../../src/server/jwt';

const SCOPE_MONITORING_READ = 'https://www.googleapis.com/auth/monitoring.read';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const MONITORING_HOST = 'https://monitoring.googleapis.com';
const TOKEN_TTL_SEC = 3600;
const TOKEN_CACHE_REFRESH_BUFFER_SEC = 600; // refresh if < 10 min remaining

interface ServiceAccountKey {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string; // PKCS8 PEM
  client_email: string;
  token_uri?: string;
}

interface AccessTokenCache {
  token: string;
  expiresAtSec: number;
}

const TOKEN_CACHE = new Map<string, AccessTokenCache>();

interface GcpMonitoringEnv {
  GCP_SERVICE_ACCOUNT_KEY_JSON?: string;
  GCP_PROJECT_ID?: string;
}

/**
 * Parse service account JSON env. Returns null on missing/invalid input —
 * caller falls back to D1 proxy.
 */
function parseServiceAccount(rawJson: string | undefined): ServiceAccountKey | null {
  if (!rawJson || typeof rawJson !== 'string') return null;
  try {
    const parsed = JSON.parse(rawJson) as ServiceAccountKey;
    if (parsed.type !== 'service_account') return null;
    if (typeof parsed.private_key !== 'string' || !parsed.private_key.includes('BEGIN')) return null;
    if (typeof parsed.client_email !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Exchange service-account JWT for OAuth2 access_token. Cached in-isolate
 * by client_email + private_key_id to survive across requests in same Worker
 * instance.
 */
async function getAccessToken(account: ServiceAccountKey): Promise<string | null> {
  const cacheKey = `${account.client_email}:${account.private_key_id}`;
  const nowSec = Math.floor(Date.now() / 1000);
  const cached = TOKEN_CACHE.get(cacheKey);
  if (cached && cached.expiresAtSec - nowSec > TOKEN_CACHE_REFRESH_BUFFER_SEC) {
    return cached.token;
  }

  // Build JWT bearer assertion per RFC 7523 §2.1
  const claims: JwtClaims = {
    iss: account.client_email,
    sub: account.client_email,
    aud: account.token_uri ?? TOKEN_ENDPOINT,
    scope: SCOPE_MONITORING_READ,
    iat: nowSec,
    exp: nowSec + TOKEN_TTL_SEC,
  };
  let assertion: string;
  try {
    const privateKey = await importPrivateKey(account.private_key);
    assertion = await signJwt(claims, privateKey, account.private_key_id);
  } catch {
    return null;
  }

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  let resp: Response;
  try {
    resp = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: ctrl.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) return null;
  const json = (await resp.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : TOKEN_TTL_SEC;
  TOKEN_CACHE.set(cacheKey, {
    token: json.access_token,
    expiresAtSec: nowSec + expiresIn,
  });
  return json.access_token;
}

/** Map GCP consumed_api label → quota-estimate service key. */
const GCP_API_TO_SERVICE: Record<string, string> = {
  'places-backend.googleapis.com': 'search_text',
  'places.googleapis.com': 'place_details',
  'directions.googleapis.com': 'directions',
  'routes.googleapis.com': 'directions',
  'maps-backend.googleapis.com': 'maps_js',
  'geocoding-backend.googleapis.com': 'geocoding',
  'geocoder.googleapis.com': 'geocoding',
  'placeautocomplete.googleapis.com': 'autocomplete',
};

interface ServiceCount {
  service: string;
  count_24h: number;
}

interface TimeSeriesPoint {
  value?: { int64Value?: string; doubleValue?: number };
}

interface TimeSeries {
  resource?: { labels?: { service?: string } };
  metric?: { labels?: { consumed_api?: string } };
  points?: TimeSeriesPoint[];
}

interface TimeSeriesResponse {
  timeSeries?: TimeSeries[];
}

/**
 * Query Cloud Monitoring for last-24h Maps Platform request counts, grouped
 * by consumed_api label. Returns null on any failure → caller fallback.
 */
export async function fetchMapsQuotaFromCloudMonitoring(
  env: GcpMonitoringEnv,
): Promise<ServiceCount[] | null> {
  const account = parseServiceAccount(env.GCP_SERVICE_ACCOUNT_KEY_JSON);
  if (!account) return null;
  const projectId = env.GCP_PROJECT_ID ?? account.project_id;
  if (!projectId) return null;

  const accessToken = await getAccessToken(account);
  if (!accessToken) return null;

  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Filter: serviceruntime API request_count + Maps Platform services only.
  // `resource.type="consumed_api"` 是 Maps Platform / serviceruntime 標準 resource type。
  const filter =
    'metric.type="serviceruntime.googleapis.com/api/request_count" ' +
    'AND resource.type="consumed_api"';

  const params = new URLSearchParams({
    filter,
    'interval.startTime': startTime,
    'interval.endTime': endTime,
    'aggregation.alignmentPeriod': '86400s',
    'aggregation.perSeriesAligner': 'ALIGN_SUM',
    'aggregation.crossSeriesReducer': 'REDUCE_SUM',
    view: 'FULL',
  });
  // groupByFields 是 repeated param — URLSearchParams 接受 .append 累加。
  params.append('aggregation.groupByFields', 'metric.label."consumed_api"');

  const url = `${MONITORING_HOST}/v3/projects/${encodeURIComponent(projectId)}/timeSeries?${params}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: ctrl.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    // 401 → token expired between cache check and call → invalidate + caller can retry
    if (resp.status === 401) {
      const cacheKey = `${account.client_email}:${account.private_key_id}`;
      TOKEN_CACHE.delete(cacheKey);
    }
    return null;
  }

  const data = (await resp.json()) as TimeSeriesResponse;
  const series = data.timeSeries ?? [];
  const counts = new Map<string, number>();

  for (const ts of series) {
    const consumedApi = ts.metric?.labels?.consumed_api ?? ts.resource?.labels?.service ?? '';
    const service = GCP_API_TO_SERVICE[consumedApi];
    if (!service) continue; // 非 Maps Platform service，skip

    let total = 0;
    for (const point of ts.points ?? []) {
      const intVal = point.value?.int64Value;
      const doubleVal = point.value?.doubleValue;
      if (typeof intVal === 'string') total += Number.parseInt(intVal, 10) || 0;
      else if (typeof doubleVal === 'number') total += Math.round(doubleVal);
    }
    counts.set(service, (counts.get(service) ?? 0) + total);
  }

  return Array.from(counts.entries()).map(([service, count_24h]) => ({ service, count_24h }));
}

/** Reset in-isolate token cache — for tests only. */
export function _resetGcpTokenCacheForTest(): void {
  TOKEN_CACHE.clear();
}
