#!/usr/bin/env bun
/**
 * google-quota-monitor.ts — daily MTD quota check + kill switch hysteresis.
 *
 * Strategy:
 *   - Cloud Monitoring API: query 24h request_count for each Maps service
 *   - Estimate MTD spend (service × unit price summed for current month)
 *   - Compare to free credit budget ($200 by default, from app_settings)
 *   - 50% / 70% / 90% thresholds → Telegram alert (different urgency)
 *   - At 90% MTD → POST /api/admin/maps-lock (kill switch on)
 *   - At <50% MTD AND currently locked → POST /api/admin/maps-unlock (auto-unlock)
 *
 * Hysteresis (autoplan C4 — kept per user direction):
 *   90% lock / 50% unlock prevents flapping at threshold.
 *
 * Triggered by: launchd com.tripline.daily-check (mac mini cron)
 *
 * Required env: TRIPLINE_API_URL, TRIPLINE_API_TOKEN, GOOGLE_CLOUD_PROJECT_ID,
 *               GOOGLE_CLOUD_SA_KEY (service account JSON string)
 *
 * NOTE: Cloud Monitoring API auth requires google-auth-library. For initial
 * deploy this script falls back to admin endpoint /api/admin/quota-estimate
 * which uses Google Maps Platform Console quota usage API (simpler shim).
 * Full Cloud Monitoring integration deferred to v2.24.0 (TODO).
 */
import { loadCronEnv, makeApiClient, alertTelegram } from './_lib/cron-shared';

const PRICE_PER_1K = {
  search_text: 32, // Places API Text Search
  place_details: 17, // Place Details
  directions: 5, // Routes API (driving)
  maps_js: 7, // Maps JavaScript loads
  geocoding: 5, // Geocoding
  autocomplete: 2.83, // Place Autocomplete
} as const;

interface QuotaEstimate {
  service: keyof typeof PRICE_PER_1K;
  count_24h: number;
}

interface AppSettings {
  budget_usd: number;
  lock_threshold_pct: number;
  unlock_threshold_pct: number;
  is_locked: boolean;
}

const ENV = loadCronEnv();
const api = makeApiClient(ENV);

/** Estimate cost ($) from per-service 24h counts. */
function estimateCost(estimates: QuotaEstimate[]): number {
  return estimates.reduce((sum, e) => sum + (e.count_24h / 1000) * PRICE_PER_1K[e.service], 0);
}

async function main(): Promise<void> {
  console.log('💰 Google Maps quota monitor');

  // Read budget + thresholds + lock state from app_settings via admin endpoint
  const settings = await api<AppSettings>('GET', '/api/admin/maps-settings');
  console.log(`   Budget: $${settings.budget_usd}/mo`);
  console.log(`   Thresholds: lock@${settings.lock_threshold_pct}% / unlock@${settings.unlock_threshold_pct}%`);
  console.log(`   Currently locked: ${settings.is_locked}`);

  // Fetch quota estimate (24h per-service counts) — admin shim endpoint
  const estimates = await api<QuotaEstimate[]>('GET', '/api/admin/quota-estimate');
  const dailyCost = estimateCost(estimates);

  // MTD = daily × days elapsed in current month
  const now = new Date();
  const dayOfMonth = now.getDate();
  const mtdCost = dailyCost * dayOfMonth;
  const mtdPct = (mtdCost / settings.budget_usd) * 100;
  const remainingUsd = Math.max(0, settings.budget_usd - mtdCost);

  console.log(`   24h cost estimate: $${dailyCost.toFixed(2)}`);
  console.log(`   MTD estimate: $${mtdCost.toFixed(2)} (${mtdPct.toFixed(1)}%)`);
  console.log(`   Remaining: $${remainingUsd.toFixed(2)}`);

  // Build status emoji
  let icon = '🟢';
  if (mtdPct >= settings.lock_threshold_pct) icon = '🔴';
  else if (mtdPct >= 70) icon = '🟠';
  else if (mtdPct >= 50) icon = '🟡';

  const summary = `${icon} Google Maps MTD: $${mtdCost.toFixed(2)} / $${settings.budget_usd} (${mtdPct.toFixed(1)}%) — 剩 $${remainingUsd.toFixed(2)}`;

  // Trigger lock / unlock transitions
  if (mtdPct >= settings.lock_threshold_pct && !settings.is_locked) {
    console.log(`🔒 Locking (MTD ${mtdPct.toFixed(1)}% ≥ ${settings.lock_threshold_pct}%)`);
    await api('POST', '/api/admin/maps-lock', {
      reason: `自動鎖定：MTD $${mtdCost.toFixed(2)} / $${settings.budget_usd} (${mtdPct.toFixed(1)}%)`,
    });
    await alertTelegram(`🚨 ${summary}\n→ Google Maps 自動鎖定（503）月初解除`);
  } else if (mtdPct <= settings.unlock_threshold_pct && settings.is_locked) {
    console.log(`🔓 Unlocking (MTD ${mtdPct.toFixed(1)}% ≤ ${settings.unlock_threshold_pct}%)`);
    await api('POST', '/api/admin/maps-unlock', {});
    await alertTelegram(`${summary}\n→ Google Maps 自動解鎖`);
  } else {
    // Daily summary (low + medium thresholds → Telegram only at 50/70/90 first crossing)
    const sendDaily = mtdPct >= 50 || dayOfMonth === 1 || dayOfMonth === 15;
    if (sendDaily) await alertTelegram(summary);
    console.log(summary);
  }

  // Cleanup expired pois_search_cache rows so 24h-TTL table doesn't grow unbounded.
  try {
    const { deleted } = await api<{ deleted: number }>('POST', '/api/admin/cache-cleanup');
    if (deleted > 0) console.log(`🧹 Cleaned ${deleted} expired cache rows.`);
  } catch (err) {
    console.warn('Cache cleanup failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('FATAL:', msg);
  alertTelegram(`🚨 google-quota-monitor FAILED: ${msg}`);
  process.exit(1);
});
