#!/usr/bin/env node
/**
 * daily-check.js — 每日問題報告腳本
 *
 * 查詢 6 個數據來源，產出 JSON 報告，並可選發送 Telegram 摘要。
 * 由 GitHub Actions 每天 UTC 22:13（台灣 06:13）自動觸發。
 *
 * 環境變數：
 *   CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, D1_DATABASE_ID
 *   SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID（可選，有則發送 Telegram）
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
var { execSync } = require('child_process');

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

// ── 日期工具 ────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ── 數據來源 1: Sentry 未解決 issues ────────────────────────────

async function querySentry() {
  var url = 'https://sentry.io/api/0/projects/' + SENTRY_ORG + '/' + SENTRY_PROJECT +
    '/issues/?query=is:unresolved&statsPeriod=24h';
  var res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + SENTRY_TOKEN }
  });
  if (!res.ok) throw new Error('Sentry API failed: ' + res.status);
  var issues = await res.json();

  var mapped = issues.map(function(i) {
    // 取出最頂層 frame（file + lineno）
    var file = '';
    try {
      var frames = i.firstSeen &&
        i.entries &&
        i.entries[0] &&
        i.entries[0].data &&
        i.entries[0].data.values &&
        i.entries[0].data.values[0] &&
        i.entries[0].data.values[0].stacktrace &&
        i.entries[0].data.values[0].stacktrace.frames;
      if (frames && frames.length > 0) {
        var top = frames[frames.length - 1];
        file = (top.filename || '') + (top.lineno ? ':' + top.lineno : '');
      }
    } catch (_) { /* ignore */ }

    return {
      id: i.id,
      title: i.title,
      count: parseInt(i.count, 10) || 0,
      users: (i.userCount) || 0,
      lastSeen: i.lastSeen || '',
      file: file,
      link: i.permalink || ''
    };
  });

  var status = 'ok';
  if (mapped.length > 0) status = 'warning';

  return {
    status: status,
    total: mapped.length,
    issues: mapped
  };
}

// ── 數據來源 2: D1 api_logs — 昨日 4xx/5xx ──────────────────────

async function queryApiErrors() {
  var rows = await queryD1(
    "SELECT path, method, status, COUNT(*) as count, MAX(created_at) as lastOccurred " +
    "FROM api_logs " +
    "WHERE created_at >= datetime('now', '-1 day') AND status >= 400 " +
    "GROUP BY path, method, status " +
    "ORDER BY count DESC LIMIT 20"
  );

  var total = rows.reduce(function(sum, r) { return sum + (r.count || 0); }, 0);
  var status = 'ok';
  if (total > 0) {
    var has5xx = rows.some(function(r) { return r.status >= 500; });
    status = has5xx ? 'critical' : 'warning';
  }

  return {
    status: status,
    total: total,
    errors: rows.map(function(r) {
      return {
        path: r.path,
        method: r.method || 'UNKNOWN',
        status: r.status,
        count: r.count,
        lastOccurred: r.lastOccurred || ''
      };
    })
  };
}

// ── 數據來源 3: D1 audit_log — encoding_warning ─────────────────

async function queryEncodingWarnings() {
  var rows = await queryD1(
    "SELECT id, trip_id, table_name, action, created_at " +
    "FROM audit_log " +
    "WHERE created_at >= datetime('now', '-1 day') " +
    "AND json_extract(diff_json, '$.encoding_warning') IS NOT NULL " +
    "ORDER BY created_at DESC LIMIT 20"
  );

  var status = rows.length > 0 ? 'warning' : 'ok';

  return {
    status: status,
    total: rows.length,
    records: rows.map(function(r) {
      return {
        id: r.id,
        tripId: r.trip_id,
        table: r.table_name,
        action: r.action,
        createdAt: r.created_at
      };
    })
  };
}

// ── 數據來源 4: Workers Analytics ───────────────────────────────

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
    return { status: 'ok', requests: 0, errors: 0, errorRate: '0%', p50: 0, p99: 0 };
  }
  var rows = data.data.viewer.accounts[0].pagesFunctionsInvocationsAdaptiveGroups;
  if (!rows || rows.length === 0) {
    return { status: 'ok', requests: 0, errors: 0, errorRate: '0%', p50: 0, p99: 0 };
  }
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

  var errorRate = totalRequests > 0
    ? ((totalErrors / totalRequests) * 100).toFixed(2) + '%'
    : '0%';
  var status = totalErrors > 0 ? 'warning' : 'ok';

  return {
    status: status,
    requests: totalRequests,
    errors: totalErrors,
    errorRate: errorRate,
    p50: Math.round(maxP50 * 10) / 10,
    p99: Math.round(maxP99 * 10) / 10
  };
}

// ── 數據來源 5: Web Analytics ────────────────────────────────────

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
    return { visits: 0, pageViews: 0 };
  }
  var rows = data.data.viewer.accounts[0].rumPageloadEventsAdaptiveGroups;
  if (!rows || rows.length === 0) {
    return { visits: 0, pageViews: 0 };
  }
  var row = rows[0];
  return {
    visits: row.sum && row.sum.visits ? row.sum.visits : 0,
    pageViews: row.sum && row.sum.visits ? row.sum.visits : 0
  };
}

// ── 數據來源 6: npm audit ────────────────────────────────────────

function queryNpmAudit() {
  try {
    var output = execSync('npm audit --json --production 2>/dev/null || npm audit --json 2>/dev/null || echo "{}"', {
      encoding: 'utf8',
      timeout: 60000,
      cwd: path.join(__dirname, '..')
    });
    var parsed = JSON.parse(output);

    var vulns = [];
    if (parsed.vulnerabilities) {
      // npm audit v2 format
      Object.keys(parsed.vulnerabilities).forEach(function(pkgName) {
        var v = parsed.vulnerabilities[pkgName];
        if (v.severity && v.severity !== 'info') {
          vulns.push({
            name: pkgName,
            severity: v.severity,
            package: pkgName,
            fixAvailable: v.fixAvailable ? (typeof v.fixAvailable === 'object' ? v.fixAvailable.name + '@' + v.fixAvailable.version : 'yes') : 'no'
          });
        }
      });
    } else if (parsed.advisories) {
      // npm audit v1 format
      Object.values(parsed.advisories).forEach(function(a) {
        vulns.push({
          name: a.title,
          severity: a.severity,
          package: a.module_name,
          fixAvailable: a.recommendation || ''
        });
      });
    }

    var hasCritical = vulns.some(function(v) { return v.severity === 'critical' || v.severity === 'high'; });
    var status = vulns.length === 0 ? 'ok' : (hasCritical ? 'critical' : 'warning');

    return {
      status: status,
      total: vulns.length,
      vulnerabilities: vulns
    };
  } catch (err) {
    console.error('npm audit failed:', err.message);
    return {
      status: 'ok',
      total: 0,
      vulnerabilities: [],
      note: 'npm audit 執行失敗: ' + err.message
    };
  }
}

// ── summary 計算 ────────────────────────────────────────────────

function calcSummary(sentry, apiErrors, encodingWarnings, workers, npmAudit) {
  var sections = [sentry, apiErrors, encodingWarnings, workers, npmAudit];
  var critical = sections.filter(function(s) { return s && s.status === 'critical'; }).length;
  var warning = sections.filter(function(s) { return s && s.status === 'warning'; }).length;
  var ok = sections.filter(function(s) { return s && s.status === 'ok'; }).length;
  return {
    totalIssues: critical + warning,
    critical: critical,
    warning: warning,
    ok: ok
  };
}

// ── Telegram 發送 ────────────────────────────────────────────────

async function sendTelegram(summary) {
  var token = process.env.TELEGRAM_BOT_TOKEN;
  var chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: summary, parse_mode: 'HTML' })
  });
}

function buildTelegramText(report) {
  var lines = [];
  lines.push('📋 <b>每日問題報告</b> — ' + report.date);
  lines.push('');

  // API 錯誤
  if (report.apiErrors && report.apiErrors.total > 0) {
    var icon = report.apiErrors.status === 'critical' ? '🔴' : '🟡';
    lines.push(icon + ' API 錯誤 ' + report.apiErrors.total + ' 次');
    report.apiErrors.errors.slice(0, 5).forEach(function(e) {
      lines.push('  • ' + e.method + ' ' + e.path + ' → ' + e.status + ' x' + e.count);
    });
  } else {
    lines.push('✅ API 錯誤：無');
  }

  // Sentry
  if (report.sentry && report.sentry.total > 0) {
    lines.push('');
    lines.push('🟡 Sentry ' + report.sentry.total + ' issues');
    report.sentry.issues.slice(0, 3).forEach(function(i) {
      lines.push('  • ' + i.title.substring(0, 60) + (i.count ? ' (' + i.count + '次)' : ''));
    });
  } else {
    lines.push('✅ Sentry：無未解決 issues');
  }

  // encoding warnings
  if (report.encodingWarnings && report.encodingWarnings.total > 0) {
    lines.push('');
    lines.push('🟡 Encoding 警告 ' + report.encodingWarnings.total + ' 筆');
  }

  // Workers
  lines.push('');
  if (report.workers) {
    var wIcon = report.workers.status === 'ok' ? '✅' : '🟡';
    lines.push(wIcon + ' Workers: ' + (report.workers.requests || 0).toLocaleString() + ' req, ' +
      (report.workers.errors || 0) + ' errors');
  }

  // Web
  if (report.web) {
    lines.push('✅ Web: ' + (report.web.visits || 0) + ' visits');
  }

  // npm audit
  if (report.npmAudit) {
    if (report.npmAudit.total === 0) {
      lines.push('✅ npm audit: 無漏洞');
    } else {
      var nIcon = report.npmAudit.status === 'critical' ? '🔴' : '🟡';
      lines.push(nIcon + ' npm audit: ' + report.npmAudit.total + ' 個漏洞');
    }
  }

  lines.push('');
  lines.push('詳情見 JSON：daily-check-' + report.date + '.json');

  return lines.join('\n');
}

// ── Log rotation ────────────────────────────────────────────────

function rotateOldLogs(logsDir) {
  try {
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    var files = fs.readdirSync(logsDir);
    files.forEach(function(f) {
      if (!f.startsWith('daily-check-') || !f.endsWith('.json')) return;
      var fullPath = path.join(logsDir, f);
      var stat = fs.statSync(fullPath);
      if (stat.mtimeMs < cutoff.getTime()) {
        fs.unlinkSync(fullPath);
        console.log('Deleted old log: ' + f);
      }
    });
  } catch (err) {
    console.error('Log rotation failed:', err.message);
  }
}

// ── 主流程 ──────────────────────────────────────────────────────

async function main() {
  var today = todayISO();
  console.log('Daily check starting — ' + today);

  // 並行查詢所有數據來源（任一失敗不影響其他）
  var settled = await Promise.allSettled([
    querySentry(),           // 0
    queryApiErrors(),        // 1
    queryEncodingWarnings(), // 2
    queryWorkersAnalytics(), // 3
    queryWebAnalytics(),     // 4
  ]);

  // npm audit 同步執行（不影響其他）
  var npmAuditResult = queryNpmAudit();

  function val(idx, fallback) {
    var r = settled[idx];
    if (r.status === 'fulfilled') return r.value;
    console.error('Source ' + idx + ' failed:', r.reason && r.reason.message ? r.reason.message : r.reason);
    return fallback;
  }

  var sentry = val(0, { status: 'ok', total: 0, issues: [] });
  var apiErrors = val(1, { status: 'ok', total: 0, errors: [] });
  var encodingWarnings = val(2, { status: 'ok', total: 0, records: [] });
  var workers = val(3, { status: 'ok', requests: 0, errors: 0, errorRate: '0%', p50: 0, p99: 0 });
  var web = val(4, { visits: 0, pageViews: 0 });

  var summary = calcSummary(sentry, apiErrors, encodingWarnings, workers, npmAuditResult);

  var report = {
    date: today,
    generatedAt: new Date().toISOString(),
    summary: summary,
    sentry: sentry,
    apiErrors: apiErrors,
    encodingWarnings: encodingWarnings,
    workers: workers,
    web: web,
    npmAudit: npmAuditResult
  };

  // 確保 logs 目錄存在
  var logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // 寫出 JSON
  var outPath = path.join(logsDir, 'daily-check-' + today + '.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('Report written to: ' + outPath);

  // Log rotation（刪除 7 天前的 JSON）
  rotateOldLogs(logsDir);

  // 發送 Telegram 摘要
  var telegramText = buildTelegramText(report);
  try {
    await sendTelegram(telegramText);
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      console.log('Telegram sent');
    }
  } catch (err) {
    console.error('Telegram send failed:', err.message);
  }

  console.log('Daily check done — ' + JSON.stringify(summary));
}

main().catch(function(err) {
  console.error('Daily check failed:', err);
  process.exit(1);
});
