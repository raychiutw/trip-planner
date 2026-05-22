/**
 * google-maps-quota.js — pure cost calc + status classify helper.
 *
 * v2.31.96: 從 scripts/google-quota-monitor.ts 抽出來成共用 lib，讓
 * daily-check.js 也能算 MTD。價格表必須與 google-quota-monitor.ts SoT
 * 對齊（test 會偵測 drift）。
 *
 * Units:
 *   - count_24h: per-service request count in past 24h
 *   - dailyCost / mtdCost: USD
 *   - mtdPct / lockThresholdPct: 0-100 percent
 */
'use strict';

// price per 1000 requests, USD. 對齊 google-quota-monitor.ts PRICE_PER_1K。
var PRICE_PER_1K = {
  search_text: 32, // Places API Text Search
  place_details: 17, // Place Details
  directions: 5, // Routes API (driving)
  maps_js: 7, // Maps JavaScript loads
  geocoding: 5, // Geocoding
  autocomplete: 2.83, // Place Autocomplete
};

function calcDailyCost(estimates) {
  return estimates.reduce(function (sum, e) {
    var price = PRICE_PER_1K[e.service] || 0;
    return sum + (e.count_24h / 1000) * price;
  }, 0);
}

function calcMtdCost(estimates, dayOfMonth) {
  return calcDailyCost(estimates) * dayOfMonth;
}

function classifyStatus(mtdPct, lockThresholdPct) {
  if (mtdPct >= lockThresholdPct) return 'critical';
  if (mtdPct >= 50) return 'warning';
  return 'ok';
}

module.exports = { PRICE_PER_1K: PRICE_PER_1K, calcDailyCost: calcDailyCost, calcMtdCost: calcMtdCost, classifyStatus: classifyStatus };
