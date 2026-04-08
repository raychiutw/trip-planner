#!/usr/bin/env node
/**
 * daily-check.js — 每日問題報告腳本
 *
 * 查詢 7 個數據來源 + 排程 error log，產出 JSON 報告。
 * Telegram 發送由 daily-check-scheduler.sh → /tp-daily-check 處理。
 *
 * 環境變數：
 *   CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, D1_DATABASE_ID
 *   SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
 */
'use strict';

var fs = require('fs');
var path = require('path');
var { execSync } = require('child_process');

// 從 openspec/config.yaml 讀取 env（fallback for 本機執行）
function loadConfigYaml() {
  try {
    var configPath = path.join(__dirname, '..', 'openspec', 'config.yaml');
    var content = fs.readFileSync(configPath, 'utf8');
    var env = {};
    var inEnv = false;
    content.split('\n').forEach(function(line) {
      if (/^env:/.test(line)) { inEnv = true; return; }
      if (inEnv && /^\S/.test(line)) { inEnv = false; return; }
      if (inEnv) {
        var m = line.match(/^\s+(\w+):\s*(.+)/);
        if (m && !m[2].startsWith('#') && !m[2].startsWith('(')) {
          env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/#.*$/, '').trim();
        }
      }
    });
    return env;
  } catch(e) { return {}; }
}

// 從 .env.local 讀取本機 secrets（不進版控）
function loadEnvLocal() {
  try {
    var envPath = path.join(__dirname, '..', '.env.local');
    var content = fs.readFileSync(envPath, 'utf8');
    var env = {};
    content.split('\n').forEach(function(line) {
      var m = line.match(/^(\w+)=(.+)/);
      if (m) env[m[1]] = m[2].trim();
    });
    return env;
  } catch(e) { return {}; }
}

var yamlEnv = loadConfigYaml();
var localEnv = loadEnvLocal();
function env(key) { return process.env[key] || localEnv[key] || yamlEnv[key] || ''; }

var CF_TOKEN = env('CLOUDFLARE_API_TOKEN');
var CF_ACCOUNT = env('CF_ACCOUNT_ID');
var D1_DB = env('D1_DATABASE_ID');
var SENTRY_TOKEN = env('SENTRY_AUTH_TOKEN');
var SENTRY_ORG = env('SENTRY_ORG');
var SENTRY_PROJECT = env('SENTRY_PROJECT');

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

// ── 數據來源 3: Workers Analytics ───────────────────────────────

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
    'sum { visits pageViews } ' +
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
    pageViews: row.sum && row.sum.pageViews ? row.sum.pageViews : 0
  };
}

// ── 數據來源 6: npm audit ────────────────────────────────────────

function queryNpmAudit() {
  try {
    var output = execSync('npm audit --json --production 2>/dev/null; true', {
      encoding: 'utf8',
      timeout: 60000,
      cwd: path.join(__dirname, '..')
    });
    var parsed = output.trim() ? JSON.parse(output) : {};

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

// ── 數據來源 7: tp-request 錯誤統計 ─────────────────────────────

async function queryRequestErrors() {
  // 查詢非 completed 的請求（含 open 超過 1 小時未處理）
  var rows = await queryD1(
    "SELECT id, trip_id, mode, status, substr(message, 1, 80) as message, " +
    "substr(reply, 1, 80) as reply, created_at " +
    "FROM trip_requests " +
    "WHERE status != 'completed' " +
    "ORDER BY created_at DESC " +
    "LIMIT 20"
  );

  // 額外篩出 status='open' 超過 1 小時未處理（視為排程失敗）
  var stale = rows.filter(function(r) {
    if (r.status !== 'open') return false;
    var created = new Date(r.created_at);
    var ageMs = Date.now() - created.getTime();
    return ageMs > 60 * 60 * 1000; // > 1 小時
  });

  var status = 'ok';
  if (rows.length > 0) status = 'warning';

  return {
    status: status,
    total: rows.length,
    staleCount: stale.length,
    pending: rows.map(function(r) {
      return {
        id: r.id,
        tripId: r.trip_id,
        mode: r.mode,
        status: r.status,
        message: r.message || '',
        reply: r.reply || '',
        createdAt: r.created_at
      };
    })
  };
}

// ── 數據來源 8: D1 統計（api_logs total + audit_log）─────────────

async function queryD1Stats(apiErrorsResult) {
  // server/client error counts 從 apiErrors 推導，省掉重複 D1 subquery
  var serverErrors = 0;
  var clientErrors = 0;
  if (apiErrorsResult && apiErrorsResult.errors) {
    apiErrorsResult.errors.forEach(function(e) {
      if (e.status >= 500) serverErrors += (e.count || 0);
      else if (e.status >= 400) clientErrors += (e.count || 0);
    });
  }

  var rows = await queryD1(
    "SELECT " +
    "(SELECT COUNT(*) FROM api_logs) as total_logs, " +
    "(SELECT COUNT(*) FROM audit_log WHERE created_at >= datetime('now', '-1 day')) as audit_count"
  );

  var row = rows && rows[0] ? rows[0] : {};
  var status = serverErrors > 0 ? 'warning' : 'ok';

  return {
    status: status,
    totalLogs: row.total_logs || 0,
    serverErrors: serverErrors,
    clientErrors: clientErrors,
    auditCount: row.audit_count || 0
  };
}

// ── 數據來源 8: 排程 error log ────────────────────────────────

function querySchedulerErrors() {
  var baseDir = path.join(__dirname, 'logs');
  var dirs = ['tp-request', 'daily-check', 'api-server'];
  var cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  var results = {};
  var totalErrors = 0;

  dirs.forEach(function(dir) {
    var dirPath = path.join(baseDir, dir);
    var errors = [];
    try {
      var files = fs.readdirSync(dirPath).filter(function(f) {
        return f.endsWith('.error.log');
      });
      files.forEach(function(f) {
        var filePath = path.join(dirPath, f);
        var stat = fs.statSync(filePath);
        if (stat.mtime < cutoff) return;
        var content = fs.readFileSync(filePath, 'utf8').trim();
        if (!content) return;
        var lines = content.split('\n');
        lines.forEach(function(line) {
          var match = line.match(/^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+Z?)?)\] \[error\] (.+)/);
          if (match) {
            var ts = new Date(match[1].replace(' ', 'T'));
            if (ts >= cutoff && errors.length < 5) {
              errors.push({ time: match[1], message: match[2].substring(0, 100) });
            }
          }
        });
      });
    } catch (e) {}
    results[dir] = { count: errors.length, errors: errors };
    totalErrors += errors.length;
  });

  return {
    status: totalErrors > 0 ? 'warning' : 'ok',
    total: totalErrors,
    details: results
  };
}

// ── summary 計算 ────────────────────────────────────────────────

function calcSummary(sentry, apiErrors, workers, npmAudit, requestErrors, d1Stats, schedulerErrors) {
  var sections = [sentry, apiErrors, workers, npmAudit, requestErrors, d1Stats, schedulerErrors];
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

// ── 流水編號產生器 ───────────────────────────────────────────────

function makeCounter() {
  var n = 0;
  return function() { return ++n; };
}

// ── JSON 加編號（就地修改各來源的 issue/error 項目）──────────────

function assignNums(report) {
  var counter = makeCounter();

  if (report.sentry && report.sentry.issues) {
    report.sentry.issues.forEach(function(i) { i.num = counter(); });
  }
  if (report.apiErrors && report.apiErrors.errors) {
    report.apiErrors.errors.forEach(function(e) { e.num = counter(); });
  }
  if (report.requestErrors && report.requestErrors.pending) {
    report.requestErrors.pending.forEach(function(p) { p.num = counter(); });
  }
  if (report.npmAudit && report.npmAudit.vulnerabilities) {
    report.npmAudit.vulnerabilities.forEach(function(v) { v.num = counter(); });
  }

  report._maxNum = counter() - 1;
}

function buildTelegramText(report) {
  var today = report.date.slice(5).replace('-', '/');
  var lines = [];

  // 收集問題項目
  var issues = [];
  if (report.apiErrors && report.apiErrors.total > 0) {
    var icon = report.apiErrors.status === 'critical' ? '🔴' : '⚠️';
    issues.push(icon + ' API errors: ' + report.apiErrors.total + ' 筆');
  }
  if (report.sentry && report.sentry.total > 0) {
    issues.push('⚠️ Sentry: ' + report.sentry.total + ' 筆');
  }
  if (report.requestErrors && report.requestErrors.total > 0) {
    issues.push('⚠️ 未完成請求: ' + report.requestErrors.total + ' 筆');
  }
  if (report.d1Stats && report.d1Stats.serverErrors > 0) {
    issues.push('⚠️ D1 server errors: ' + report.d1Stats.serverErrors + ' 筆');
  }
  if (report.schedulerErrors && report.schedulerErrors.total > 0) {
    var se = report.schedulerErrors.details;
    var parts = [];
    ['tp-request', 'daily-check', 'api-server'].forEach(function(k) {
      if (se[k] && se[k].count > 0) parts.push(k + ' ' + se[k].count + ' 筆');
    });
    issues.push('⚠️ 排程錯誤: ' + parts.join(', '));
  }
  if (report.npmAudit && report.npmAudit.total > 0) {
    issues.push('⚠️ npm vulnerabilities: ' + report.npmAudit.total + ' 個');
  }

  // 指標數據
  var metrics = [];
  if (report.workers) {
    var p50 = report.workers.p50 || 0;
    var p99 = report.workers.p99 || 0;
    metrics.push('📈 Workers: ' + (report.workers.requests || 0).toLocaleString() + ' req | err ' +
      (report.workers.errorRate || '0%') + ' | P50 ' + Math.round(p50 / 1000) + 'ms P99 ' + Math.round(p99 / 1000) + 'ms');
  }
  if (report.web) {
    metrics.push('📈 Analytics: ' + (report.web.visits || 0) + ' visits, ' + (report.web.pageViews || 0) + ' views');
  }
  if (report.npmAudit && report.npmAudit.total === 0) {
    metrics.push('📈 npm: 0 vulnerabilities');
  }

  // OK 項目
  var okItems = [];
  var schedulerDirs = ['api-server', 'daily-check', 'tp-request'];
  schedulerDirs.forEach(function(k) {
    if (!report.schedulerErrors || !report.schedulerErrors.details[k] || report.schedulerErrors.details[k].count === 0) okItems.push(k);
  });

  // 全綠判定
  if (issues.length === 0) {
    lines.push('📊 ' + today + ' ✅ 全綠');
  } else {
    lines.push('📊 Tripline 每日報告 ' + today);
    lines.push('──────────────');
    issues.forEach(function(i) { lines.push(i); });
  }

  // 自動修復（由 tp-daily-check skill 填入，這裡先放 placeholder）
  lines.push(report.autofix
    ? '🔧 自動修復: ' + report.autofix.completed + ' 項完成'
    : '🔧 無需修復');

  // 指標固定顯示
  if (metrics.length > 0) {
    lines.push('──────────────');
    metrics.forEach(function(m) { lines.push(m); });
  }

  // OK 合併
  if (okItems.length > 0) {
    lines.push('✅ OK: ' + okItems.join(', '));
  }

  return lines.join('\n');
}

// ── Log rotation ────────────────────────────────────────────────

function rotateOldLogs(logsDir) {
  try {
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    var files = fs.readdirSync(logsDir);
    files.forEach(function(f) {
      if (!f.endsWith('-report.json') && !(f.startsWith('daily-check-') && f.endsWith('.json'))) return;
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

  // 同步查詢（不影響 event loop）
  var npmAuditResult = queryNpmAudit();
  var schedulerErrors = querySchedulerErrors();

  // 並行查詢所有網路數據來源（任一失敗不影響其他）
  var settled = await Promise.allSettled([
    querySentry(),           // 0
    queryApiErrors(),        // 1
    queryWorkersAnalytics(), // 2
    queryWebAnalytics(),     // 3
    queryRequestErrors(),    // 4
  ]);

  function val(idx, fallback) {
    var r = settled[idx];
    if (r.status === 'fulfilled') return r.value;
    console.error('Source ' + idx + ' failed:', r.reason && r.reason.message ? r.reason.message : r.reason);
    return fallback;
  }

  var sentry = val(0, { status: 'ok', total: 0, issues: [] });
  var apiErrors = val(1, { status: 'ok', total: 0, errors: [] });
  var workers = val(2, { status: 'ok', requests: 0, errors: 0, errorRate: '0%', p50: 0, p99: 0 });
  var web = val(3, { visits: 0, pageViews: 0 });
  var requestErrors = val(4, { status: 'ok', total: 0, staleCount: 0, pending: [] });

  // D1Stats 依賴 apiErrors 結果（推導 server/client error counts），序列執行
  var d1Stats;
  try {
    d1Stats = await queryD1Stats(apiErrors);
  } catch (e) {
    console.error('D1Stats failed:', e.message);
    d1Stats = { status: 'ok', totalLogs: 0, serverErrors: 0, clientErrors: 0, auditCount: 0 };
  }

  var summary = calcSummary(sentry, apiErrors, workers, npmAuditResult, requestErrors, d1Stats, schedulerErrors);

  var report = {
    date: today,
    generatedAt: new Date().toISOString(),
    summary: summary,
    sentry: sentry,
    apiErrors: apiErrors,
    requestErrors: requestErrors,
    d1Stats: d1Stats,
    workers: workers,
    web: web,
    npmAudit: npmAuditResult,
    schedulerErrors: schedulerErrors
  };

  // 為所有 issue/error 項目加流水編號
  assignNums(report);

  // 確保 logs 目錄存在
  var logsDir = path.join(__dirname, 'logs', 'daily-check');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // 寫出 JSON
  var outPath = path.join(logsDir, today + '-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('Report written to: ' + outPath);

  // Log rotation（刪除 7 天前的 JSON）
  rotateOldLogs(logsDir);

  console.log('Daily check done — ' + JSON.stringify(summary));
}

main().catch(function(err) {
  console.error('Daily check failed:', err);
  process.exit(1);
});
