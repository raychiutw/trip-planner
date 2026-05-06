#!/usr/bin/env bun
/**
 * google-poi-refresh-30d.ts — daily 30d refresh of POI lifecycle.
 *
 * Triggered by:
 *   - launchd com.tripline.daily-check (mac mini cron)
 *   - Manual: bun run refresh:google
 *
 * Strategy: SELECT pois WHERE place_id IS NOT NULL AND status='active'
 *   AND (last_refreshed_at IS NULL OR < now-30d) ORDER BY last_refreshed_at ASC
 *   LIMIT 50 (autoplan T11 50/day cap). Call Place Details → write
 *   rating + status + status_reason + last_refreshed_at.
 *
 * First-call 401 → Telegram alert + exit non-zero (autoplan T15 fix).
 *
 * Required env: TRIPLINE_API_URL + TRIPLINE_API_TOKEN
 *
 * Telegram daily summary:
 *   📊 Refresh: 50 POI checked / 47 active / 2 closed / 1 missing
 */
import { loadCronEnv, makeApiClient, alertTelegram, sleep } from './_lib/cron-shared';

interface PoiRow {
  id: number;
  name: string;
  place_id: string;
}

interface EnrichResult {
  poi_id: number;
  status: 'active' | 'closed' | 'missing';
  rating: number | null;
}

const DAILY_QUOTA = 50;
const SLEEP_MS = 1500;

const ENV = loadCronEnv();
const api = makeApiClient(ENV);

async function main(): Promise<void> {
  console.log('🔁 Google POI 30d refresh');

  const { rows } = await api<{ rows: PoiRow[] }>(
    'GET',
    `/api/admin/pois-due-refresh?limit=${DAILY_QUOTA}`,
  );

  if (rows.length === 0) {
    console.log('✅ No POIs due for refresh today.');
    return;
  }
  console.log(`Refreshing ${rows.length} POI...`);

  let active = 0;
  let closed = 0;
  let missing = 0;
  let firstCall = true;

  for (const poi of rows) {
    try {
      const enrich = await api<EnrichResult>('POST', `/api/pois/${poi.id}/enrich`, {});
      if (enrich.status === 'closed') closed += 1;
      else if (enrich.status === 'missing') missing += 1;
      else active += 1;
      console.log(`  [${poi.id}] ${poi.name} → ${enrich.status}`);
      firstCall = false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // First-call 401 → likely env misconfig (autoplan T15)
      if (firstCall && /401|Unauthorized/.test(msg)) {
        const alert = '[tp-cron] GOOGLE_MAPS_API_KEY rejected — 檢查 ~/.tripline-cron/.env';
        console.error(alert);
        await alertTelegram(alert);
        process.exit(1);
      }
      console.error(`  [${poi.id}] ${poi.name} → ERROR: ${msg}`);
    }
    await sleep(SLEEP_MS);
  }

  const summary = `📊 Refresh: ${rows.length} POI checked / ${active} active / ${closed} closed / ${missing} missing`;
  console.log(summary);
  await alertTelegram(summary);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('FATAL:', msg);
  alertTelegram(`🚨 google-poi-refresh-30d FAILED: ${msg}`);
  process.exit(1);
});
