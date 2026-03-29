#!/usr/bin/env node
/**
 * daily-report.js — 每日健康報告腳本
 *
 * 彙整 7 個數據來源，組合 HTML email，透過 Resend API 寄出。
 * 由 GitHub Actions 每天 UTC 22:23（台灣 06:23）自動觸發。
 *
 * 環境變數：
 *   CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, D1_DATABASE_ID
 *   SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
 *   SITE_URL
 */
'use strict';

var CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
var CF_ACCOUNT = process.env.CF_ACCOUNT_ID;
var D1_DB = process.env.D1_DATABASE_ID;
var SENTRY_TOKEN = process.env.SENTRY_AUTH_TOKEN;
var SENTRY_ORG = process.env.SENTRY_ORG;
var SENTRY_PROJECT = process.env.SENTRY_PROJECT;
var fs = require('fs');
var path = require('path');
var REPORT_EMAIL = process.env.REPORT_EMAIL;
var SITE_URL = process.env.SITE_URL || 'https://trip-planner-dby.pages.dev';
var PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY || '';

// ── D1 REST API helper ──────────────────────────────────────────

async function queryD1(sql) {
  var url = 'https://api.cloudflare.com/client/v4/accounts/' + CF_ACCOUNT +
    '/d1/database/' + D1_DB + '/query';
  var res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + CF_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql: sql })
  });
  if (!res.ok) throw new Error('D1 query failed: ' + res.status);
  var data = await res.json();
  if (!data.success) throw new Error('D1 query error: ' + JSON.stringify(data.errors));
  return data.result[0].results;
}

// ── 數據來源 1: 行程修改統計 ────────────────────────────────────

async function queryD1Requests() {
  var rows = await queryD1(
    "SELECT " +
    "COUNT(*) as total, " +
    "SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) as open_count, " +
    "SUM(CASE WHEN status IN ('received','processing','completed') THEN 1 ELSE 0 END) as closed_count " +
    "FROM requests WHERE created_at >= datetime('now', '-1 day')"
  );
  return rows[0];
}

// ── 數據來源 2: 後端 API 錯誤 ──────────────────────────────────

async function queryD1ApiLogs() {
  var countRows = await queryD1(
    "SELECT " +
    "SUM(CASE WHEN status >= 400 AND status < 500 THEN 1 ELSE 0 END) as count_4xx, " +
    "SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) as count_5xx " +
    "FROM api_logs WHERE created_at >= datetime('now', '-1 day')"
  );
  var topRows = await queryD1(
    "SELECT path, status, COUNT(*) as cnt " +
    "FROM api_logs WHERE created_at >= datetime('now', '-1 day') AND status >= 400 " +
    "GROUP BY path, status ORDER BY cnt DESC LIMIT 5"
  );
  return { summary: countRows[0], topErrors: topRows };
}



// ── 數據來源 4: Sentry 前端錯誤 ────────────────────────────────

async function querySentry() {
  var url = 'https://sentry.io/api/0/projects/' + SENTRY_ORG + '/' + SENTRY_PROJECT +
    '/issues/?query=is:unresolved&statsPeriod=24h';
  var res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + SENTRY_TOKEN }
  });
  if (!res.ok) throw new Error('Sentry API failed: ' + res.status);
  var issues = await res.json();
  return {
    total: issues.length,
    top3: issues.slice(0, 3).map(function(i) {
      return { title: i.title, count: i.count, link: i.permalink };
    })
  };
}

// ── 數據來源 5: Workers Analytics ──────────────────────────────

async function queryWorkersAnalytics() {
  var query = '{ viewer { accounts(filter: {accountTag: "' + CF_ACCOUNT + '"}) { ' +
    'pagesFunctionsInvocationsAdaptiveGroups(limit: 10000, filter: { ' +
    'datetime_geq: "' + yesterdayISO() + 'T00:00:00Z", ' +
    'datetime_lt: "' + todayISO() + 'T00:00:00Z" }) { ' +
    'sum { requests errors subrequests } ' +
    'quantiles { cpuTimeP50 cpuTimeP99 } ' +
    'dimensions { scriptName } ' +
    '} } } }';
  var res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + CF_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: query })
  });
  if (!res.ok) throw new Error('CF GraphQL failed: ' + res.status);
  var data = await res.json();
  if (!data.data || !data.data.viewer || !data.data.viewer.accounts || !data.data.viewer.accounts[0]) {
    return { requests: 0, errors: 0, p50: 0, p99: 0 };
  }
  var rows = data.data.viewer.accounts[0].pagesFunctionsInvocationsAdaptiveGroups;
  if (!rows || rows.length === 0) return { requests: 0, errors: 0, p50: 0, p99: 0 };
  var totalRequests = 0;
  var totalErrors = 0;
  var maxP50 = 0;
  var maxP99 = 0;
  rows.forEach(function(row) {
    totalRequests += row.sum.requests;
    totalErrors += row.sum.errors;
    if (row.quantiles.cpuTimeP50 > maxP50) maxP50 = row.quantiles.cpuTimeP50;
    if (row.quantiles.cpuTimeP99 > maxP99) maxP99 = row.quantiles.cpuTimeP99;
  });
  return {
    requests: totalRequests,
    errors: totalErrors,
    p50: maxP50,
    p99: maxP99
  };
}

// ── 數據來源 6: Web Analytics（GraphQL rumPageloadEventsAdaptiveGroups）──

async function queryWebAnalytics() {
  var query = '{ viewer { accounts(filter: {accountTag: "' + CF_ACCOUNT + '"}) { ' +
    'rumPageloadEventsAdaptiveGroups(limit: 1, filter: { ' +
    'datetime_geq: "' + yesterdayISO() + 'T00:00:00Z", ' +
    'datetime_lt: "' + todayISO() + 'T00:00:00Z" }) { ' +
    'sum { visits } ' +
    '} } } }';
  var res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + CF_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: query })
  });
  if (!res.ok) throw new Error('CF GraphQL failed: ' + res.status);
  var data = await res.json();
  if (!data.data || !data.data.viewer || !data.data.viewer.accounts || !data.data.viewer.accounts[0]) {
    return { visits: 0, pageViews: 0, lcp: '—', cls: '—', inp: '—' };
  }
  var rows = data.data.viewer.accounts[0].rumPageloadEventsAdaptiveGroups;
  if (!rows || rows.length === 0) {
    return { visits: 0, pageViews: 0, lcp: '—', cls: '—', inp: '—' };
  }
  var row = rows[0];
  // Core Web Vitals 在 rumWebVitalsEventsAdaptiveGroups，這裡先用 pageload 的 visits/pageViews
  return {
    visits: row.sum?.visits || 0,
    pageViews: row.sum?.visits || 0,  // rumPageloadEvents 只有 visits，用 visits 代替 pageViews
    lcp: '—',
    cls: '—',
    inp: '—'
  };
}

// ── 數據來源 7: Lighthouse (PageSpeed Insights API) ────────────

async function runLighthouse() {
  var apiUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed' +
    '?url=' + encodeURIComponent(SITE_URL) +
    '&category=performance&category=seo&category=accessibility&category=best-practices' +
    (PAGESPEED_API_KEY ? '&key=' + PAGESPEED_API_KEY : '');
  var res = await fetch(apiUrl);
  if (!res.ok) throw new Error('PageSpeed Insights failed: ' + res.status);
  var data = await res.json();
  var cats = data.lighthouseResult.categories;
  return {
    performance: Math.round(cats.performance.score * 100),
    seo: Math.round(cats.seo.score * 100),
    accessibility: Math.round(cats.accessibility.score * 100),
    bestPractices: Math.round(cats['best-practices'].score * 100)
  };
}

// ── 壞連結檢查 ─────────────────────────────────────────────────

async function checkLinks() {
  // 1. 取得所有行程
  var tripsRes = await fetch(SITE_URL + '/api/trips');
  if (!tripsRes.ok) throw new Error('Failed to fetch trips: ' + tripsRes.status);
  var trips = await tripsRes.json();

  // 2. 收集所有 maps URLs
  var mapsUrls = [];
  for (var i = 0; i < trips.length; i++) {
    var trip = trips[i];
    if (!trip.published) continue;
    var id = trip.id || trip.tripId;
    if (!id) continue;
    try {
      var daysRes = await fetch(SITE_URL + '/api/trips/' + id + '/days');
      if (!daysRes.ok) continue;
      var days = await daysRes.json();
      collectMapsUrls(days, mapsUrls);
    } catch (_) { /* skip trip on error */ }
  }

  // 3. HEAD check with concurrency limit of 5
  var broken = [];
  var urls = dedup(mapsUrls);
  var batches = chunk(urls, 5);

  for (var b = 0; b < batches.length; b++) {
    var results = await Promise.allSettled(
      batches[b].map(function(url) {
        return fetch(url, { method: 'HEAD', redirect: 'follow' })
          .then(function(r) {
            if (r.status >= 400) broken.push({ url: url, status: r.status });
          });
      })
    );
    // Also catch network errors
    results.forEach(function(r, idx) {
      if (r.status === 'rejected') {
        broken.push({ url: batches[b][idx], status: 'network error' });
      }
    });
  }

  return broken;
}

function collectMapsUrls(days, out) {
  if (!Array.isArray(days)) return;
  days.forEach(function(day) {
    if (!day.timeline) return;
    day.timeline.forEach(function(entry) {
      if (entry.location) {
        if (entry.location.googleQuery) out.push(entry.location.googleQuery);
        if (entry.location.appleQuery) out.push(entry.location.appleQuery);
        if (entry.location.naverQuery) out.push(entry.location.naverQuery);
      }
    });
  });
}

function dedup(arr) {
  return arr.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

function chunk(arr, size) {
  var out = [];
  for (var i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// ── 資料異常偵測 ───────────────────────────────────────────────

async function checkDataAnomalies() {
  var anomalies = [];
  try {
    // 1. 空行程（有 trip 但 0 天）
    var emptyTrips = await queryD1(
      "SELECT t.id FROM trips t LEFT JOIN trip_days td ON t.id = td.trip_id WHERE td.id IS NULL AND t.published = 1"
    );
    if (emptyTrips && emptyTrips.length > 0) {
      anomalies.push('空行程（無天數）：' + emptyTrips.map(function(r) { return r.id; }).join(', '));
    }

    // 2. 孤立 POI（trip_pois 引用不存在的 poi_id）
    var orphanPois = await queryD1(
      "SELECT tp.id, tp.poi_id FROM trip_pois tp LEFT JOIN pois p ON tp.poi_id = p.id WHERE p.id IS NULL LIMIT 10"
    );
    if (orphanPois && orphanPois.length > 0) {
      anomalies.push('孤立 trip_pois（poi 不存在）：' + orphanPois.length + ' 筆');
    }

    // 3. 使用者錯誤回報（過去 24 小時）
    var recentReports = await queryD1(
      "SELECT COUNT(*) as c FROM error_reports WHERE created_at > datetime('now', '-1 day')"
    );
    if (recentReports && recentReports[0] && recentReports[0].c > 0) {
      anomalies.push('使用者錯誤回報（24h）：' + recentReports[0].c + ' 筆');
    }

    // 4. POI 缺 google_rating 比例
    var poiStats = await queryD1(
      "SELECT COUNT(*) as total, SUM(CASE WHEN google_rating IS NULL THEN 1 ELSE 0 END) as missing FROM pois WHERE type IN ('hotel','restaurant','shopping')"
    );
    if (poiStats && poiStats[0] && poiStats[0].total > 0) {
      var pct = Math.round(poiStats[0].missing / poiStats[0].total * 100);
      if (pct > 30) {
        anomalies.push('POI 缺 google_rating：' + poiStats[0].missing + '/' + poiStats[0].total + ' (' + pct + '%)');
      }
    }
  } catch (e) {
    anomalies.push('偵測失敗：' + e.message);
  }
  return anomalies;
}

// ── 清理舊 api_logs ────────────────────────────────────────────

async function cleanupOldLogs() {
  await queryD1("DELETE FROM api_logs WHERE created_at < datetime('now', '-30 days')");
}

// ── Telegram 通知 ──────────────────────────────────────────────

async function sendTelegramAlert(anomalies) {
  var token = process.env.TELEGRAM_BOT_TOKEN;
  var chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('Telegram not configured, skipping alert');
    return;
  }
  var text = '⚠️ Tripline 資料異常\n\n' + anomalies.join('\n');
  try {
    await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' }),
    });
    console.log('Telegram alert sent');
  } catch (e) {
    console.error('Telegram alert failed:', e.message);
  }
}

// ── 日期工具 ────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatDate() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// ── HTML 郵件組裝 ──────────────────────────────────────────────

function buildHtml(results) {
  var r = results;
  var sections = [];

  sections.push(sectionHtml('行程修改統計', requestsHtml(r.requests)));
  sections.push(sectionHtml('Workers Analytics', workersHtml(r.workers)));
  sections.push(sectionHtml('Web Analytics', webHtml(r.web)));
  sections.push(sectionHtml('Lighthouse 分數', lighthouseHtml(r.lighthouse)));
  sections.push(sectionHtml('前端錯誤 (Sentry)', sentryHtml(r.sentry)));
  sections.push(sectionHtml('後端 API 錯誤', apiLogsHtml(r.apiLogs)));
  sections.push(sectionHtml('壞連結檢查', linksHtml(r.links)));
  if (r.anomalies && r.anomalies.length > 0) {
    sections.push(sectionHtml('⚠️ 資料異常', '<ul style="margin:0;padding-left:20px;font-size:14px;">' +
      r.anomalies.map(function(a) { return '<li>' + a + '</li>'; }).join('') + '</ul>'));
  }

  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="' +
    'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;' +
    'max-width:640px;margin:0 auto;padding:16px;color:#1a1a1a;background:#f8f9fa;">' +
    '<h1 style="font-size:20px;margin:0 0 16px;color:#0f172a;">Tripline 日報 — ' +
    formatDate() + '</h1>' +
    sections.join('') +
    '<p style="margin-top:24px;font-size:12px;color:#94a3b8;">自動產生，由 GitHub Actions 寄出</p>' +
    '</body></html>';
}

function sectionHtml(title, content) {
  return '<div style="background:#fff;border-radius:8px;padding:16px;margin-bottom:12px;">' +
    '<h2 style="font-size:15px;margin:0 0 8px;color:#334155;">' + title + '</h2>' +
    content + '</div>';
}

function failedHtml() {
  return '<p style="color:#ef4444;">查詢失敗</p>';
}

function requestsHtml(data) {
  if (!data) return failedHtml();
  return '<table style="border-collapse:collapse;width:100%;font-size:14px;">' +
    tr('昨日新增', data.total) +
    tr('已處理', data.closed_count) +
    tr('未處理', data.open_count) +
    '</table>';
}

function workersHtml(data) {
  if (!data) return failedHtml();
  return '<table style="border-collapse:collapse;width:100%;font-size:14px;">' +
    tr('API 呼叫量', data.requests.toLocaleString()) +
    tr('錯誤數', data.errors) +
    tr('錯誤率', data.requests ? ((data.errors / data.requests) * 100).toFixed(2) + '%' : '0%') +
    tr('P50 延遲', data.p50 + ' ms') +
    tr('P99 延遲', data.p99 + ' ms') +
    '</table>';
}

function webHtml(data) {
  if (!data) return failedHtml();
  return '<table style="border-collapse:collapse;width:100%;font-size:14px;">' +
    tr('瀏覽量', data.pageViews.toLocaleString()) +
    tr('訪客數', data.visits.toLocaleString()) +
    tr('LCP (P75)', data.lcp === '—' ? '—' : data.lcp + ' ms') +
    tr('CLS (P75)', data.cls === '—' ? '—' : data.cls) +
    tr('INP (P75)', data.inp === '—' ? '—' : data.inp + ' ms') +
    '</table>';
}

function lighthouseHtml(data) {
  if (!data) return failedHtml();
  return '<table style="border-collapse:collapse;width:100%;font-size:14px;">' +
    tr('Performance', scoreLabel(data.performance)) +
    tr('SEO', scoreLabel(data.seo)) +
    tr('Accessibility', scoreLabel(data.accessibility)) +
    tr('Best Practices', scoreLabel(data.bestPractices)) +
    '</table>';
}

function scoreLabel(score) {
  var color = score >= 90 ? '#16a34a' : score >= 50 ? '#f59e0b' : '#ef4444';
  return '<span style="color:' + color + ';font-weight:600;">' + score + '</span>';
}

function sentryHtml(data) {
  if (!data) return failedHtml();
  var html = '<p style="font-size:14px;margin:0 0 8px;">未解決 issues：<strong>' +
    data.total + '</strong></p>';
  if (data.top3.length > 0) {
    html += '<ul style="margin:0;padding-left:20px;font-size:13px;">';
    data.top3.forEach(function(issue) {
      html += '<li><a href="' + escHtml(issue.link) + '" style="color:#2563eb;">' +
        escHtml(issue.title) + '</a> (' + issue.count + ')</li>';
    });
    html += '</ul>';
  }
  return html;
}

function apiLogsHtml(data) {
  if (!data) return failedHtml();
  var html = '<table style="border-collapse:collapse;width:100%;font-size:14px;">' +
    tr('4xx 錯誤', data.summary.count_4xx || 0) +
    tr('5xx 錯誤', data.summary.count_5xx || 0) +
    '</table>';
  if (data.topErrors && data.topErrors.length > 0) {
    html += '<p style="font-size:13px;margin:8px 0 4px;color:#64748b;">Top 錯誤路徑：</p>' +
      '<ul style="margin:0;padding-left:20px;font-size:13px;">';
    data.topErrors.forEach(function(e) {
      html += '<li>' + escHtml(e.path) + ' (' + e.status + ') &times; ' + e.cnt + '</li>';
    });
    html += '</ul>';
  }
  return html;
}


function linksHtml(data) {
  if (!data) return failedHtml();
  if (data.length === 0) {
    return '<p style="font-size:14px;margin:0;color:#16a34a;">全部連結正常</p>';
  }
  var html = '<p style="font-size:14px;margin:0 0 8px;color:#ef4444;">' +
    data.length + ' 個壞連結：</p>' +
    '<ul style="margin:0;padding-left:20px;font-size:13px;">';
  data.forEach(function(item) {
    html += '<li>' + escHtml(item.url) + ' → ' + item.status + '</li>';
  });
  html += '</ul>';
  return html;
}

function tr(label, value) {
  return '<tr>' +
    '<td style="padding:4px 8px 4px 0;color:#64748b;">' + label + '</td>' +
    '<td style="padding:4px 0;font-weight:600;">' + value + '</td>' +
    '</tr>';
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 輸出 HTML 檔案（由 GitHub Actions workflow 用 Gmail SMTP 寄出）──

function writeReport(html) {
  var outPath = path.join(__dirname, '..', 'report.html');
  fs.writeFileSync(outPath, html, 'utf8');
  console.log('Report written to: ' + outPath);
}

// ── 主流程 ──────────────────────────────────────────────────────

async function main() {
  console.log('Daily report starting — ' + formatDate());

  // 並行查詢所有數據來源（任一失敗不影響其他）
  var settled = await Promise.allSettled([
    queryD1Requests(),        // 0
    queryWorkersAnalytics(),  // 1
    queryWebAnalytics(),      // 2
    runLighthouse(),          // 3
    querySentry(),            // 4
    queryD1ApiLogs(),         // 5
    checkLinks(),             // 6
    checkDataAnomalies()      // 7
  ]);

  function val(idx) {
    var r = settled[idx];
    if (r.status === 'fulfilled') return r.value;
    console.error('Source ' + idx + ' failed:', r.reason);
    return null;
  }

  var results = {
    requests: val(0),
    workers: val(1),
    web: val(2),
    lighthouse: val(3),
    sentry: val(4),
    apiLogs: val(5),
    links: val(6),
    anomalies: val(7)
  };

  // 組合 HTML 並輸出檔案
  var html = buildHtml(results);
  writeReport(html);

  // Telegram 通知（異常時）
  if (results.anomalies && results.anomalies.length > 0) {
    await sendTelegramAlert(results.anomalies);
  }

  // 清理舊 api_logs（>30 天）
  try {
    await cleanupOldLogs();
    console.log('Old api_logs cleaned up');
  } catch (err) {
    console.error('Cleanup failed:', err);
  }

  console.log('Daily report done');
}

main().catch(function(err) {
  console.error('Daily report failed:', err);
  process.exit(1);
});
