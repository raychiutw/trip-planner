#!/usr/bin/env node
/**
 * daily-check.js — 每日問題報告腳本
 *
 * 查詢 7 個數據來源，產出 JSON 報告，並可選發送 Telegram 摘要。
 * 由 GitHub Actions 每天 UTC 22:13（台灣 06:13）自動觸發。
 *
 * 環境變數：
 *   CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, D1_DATABASE_ID
 *   SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
 *   TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_HOME_TOKEN, TELEGRAM_CHAT_ID（可選）
 */
'use strict';

var fs = require('fs');
var path = require('path');
var { execSync, spawn } = require('child_process');

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

// ── 數據來源 8: D1 統計（api_logs + audit_log）─────────────────

async function queryD1Stats() {
  var rows = await queryD1(
    "SELECT " +
    "(SELECT COUNT(*) FROM api_logs WHERE status >= 500) as server_errors, " +
    "(SELECT COUNT(*) FROM api_logs WHERE status >= 400 AND status < 500) as client_errors, " +
    "(SELECT COUNT(*) FROM api_logs) as total_logs, " +
    "(SELECT COUNT(*) FROM audit_log WHERE created_at >= datetime('now', '-1 day')) as audit_count"
  );

  var row = rows && rows[0] ? rows[0] : {};
  var serverErrors = row.server_errors || 0;
  var status = serverErrors > 0 ? 'warning' : 'ok';

  return {
    status: status,
    totalLogs: row.total_logs || 0,
    serverErrors: serverErrors,
    clientErrors: row.client_errors || 0,
    auditCount: row.audit_count || 0
  };
}

// ── summary 計算 ────────────────────────────────────────────────

function calcSummary(sentry, apiErrors, encodingWarnings, workers, npmAudit, requestErrors, d1Stats) {
  var sections = [sentry, apiErrors, encodingWarnings, workers, npmAudit, requestErrors, d1Stats];
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
  if (report.encodingWarnings && report.encodingWarnings.records) {
    report.encodingWarnings.records.forEach(function(r) { r.num = counter(); });
  }
  if (report.npmAudit && report.npmAudit.vulnerabilities) {
    report.npmAudit.vulnerabilities.forEach(function(v) { v.num = counter(); });
  }

  report._maxNum = counter() - 1;
}

// ── Telegram 發送 ────────────────────────────────────────────────

async function sendTelegram(summary) {
  var token = env('TELEGRAM_BOT_TOKEN') || env('TELEGRAM_BOT_HOME_TOKEN');
  var chatId = env('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return;

  await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: summary, parse_mode: 'HTML' })
  });
}

function buildTelegramText(report) {
  var lines = [];
  var num = makeCounter();

  lines.push('📋 <b>每日問題報告</b> — ' + report.date);
  lines.push('');

  // Sentry
  if (report.sentry && report.sentry.total > 0) {
    lines.push('🟡 Sentry: ' + report.sentry.total + ' issues');
    report.sentry.issues.slice(0, 5).forEach(function(i) {
      var n = num();
      lines.push('  [' + n + '] ' + i.title.substring(0, 60) + (i.count ? '（' + i.count + ' 次）' : ''));
    });
  } else {
    lines.push('✅ Sentry：無未解決 issues');
  }

  // API 錯誤
  lines.push('');
  if (report.apiErrors && report.apiErrors.total > 0) {
    var icon = report.apiErrors.status === 'critical' ? '🔴' : '🟡';
    lines.push(icon + ' API 錯誤: ' + report.apiErrors.total + ' 次');
    report.apiErrors.errors.slice(0, 5).forEach(function(e) {
      var n = num();
      lines.push('  [' + n + '] ' + e.method + ' ' + e.path + ' → ' + e.status + ' x' + e.count);
    });
  } else {
    lines.push('✅ API 錯誤：無');
  }

  // 未完成請求
  if (report.requestErrors && report.requestErrors.total > 0) {
    lines.push('');
    lines.push('🟡 未完成請求: ' + report.requestErrors.total + ' 筆');
    report.requestErrors.pending.slice(0, 5).forEach(function(p) {
      var n = num();
      var msg = p.message ? '「' + p.message.substring(0, 20) + '」' : '';
      lines.push('  [' + n + '] #' + p.id + ' ' + p.mode + ' ' + p.status + msg);
    });
  }

  // encoding warnings
  if (report.encodingWarnings && report.encodingWarnings.total > 0) {
    lines.push('');
    lines.push('🟡 Encoding 警告 ' + report.encodingWarnings.total + ' 筆');
    report.encodingWarnings.records.slice(0, 3).forEach(function(r) {
      var n = num();
      lines.push('  [' + n + '] #' + r.id + ' ' + r.table + ' ' + r.action);
    });
  }

  // D1 統計
  lines.push('');
  if (report.d1Stats) {
    var d1Icon = report.d1Stats.serverErrors > 0 ? '🟡' : '✅';
    var n = num();
    lines.push(d1Icon + ' [' + n + '] D1: ' + (report.d1Stats.totalLogs || 0).toLocaleString() + ' API logs, ' +
      (report.d1Stats.serverErrors || 0) + ' server errors, ' +
      (report.d1Stats.clientErrors || 0) + ' client errors, ' +
      (report.d1Stats.auditCount || 0) + ' audits (24h)');
  }

  // Workers
  if (report.workers) {
    var wIcon = report.workers.status === 'ok' ? '✅' : '🟡';
    var nw = num();
    lines.push(wIcon + ' [' + nw + '] Workers: ' + (report.workers.requests || 0).toLocaleString() + ' req, ' +
      (report.workers.errors || 0) + ' errors, P50=' + (report.workers.p50 || 0) + 'μs, P99=' + (report.workers.p99 || 0) + 'μs');
  }

  // Web
  if (report.web) {
    var nweb = num();
    lines.push('✅ [' + nweb + '] Web: ' + (report.web.visits || 0) + ' visits, ' + (report.web.pageViews || 0) + ' pageViews');
  }

  // npm audit
  if (report.npmAudit) {
    if (report.npmAudit.total === 0) {
      var nnpm = num();
      lines.push('✅ [' + nnpm + '] npm audit: 0 漏洞');
    } else {
      var nIcon = report.npmAudit.status === 'critical' ? '🔴' : '🟡';
      lines.push(nIcon + ' npm audit: ' + report.npmAudit.total + ' 個漏洞');
      report.npmAudit.vulnerabilities.slice(0, 3).forEach(function(v) {
        var n = num();
        lines.push('  [' + n + '] ' + v.package + ' (' + v.severity + ')');
      });
    }
  }

  lines.push('');
  lines.push('回覆編號操作，例如：「看 1」「修 2 5」');

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

// ── 自動修復 ────────────────────────────────────────────────────

var PROJECT_DIR = path.join(__dirname, '..');
var AUTOFIX_TIMEOUT_MS = 20 * 60 * 1000; // Concern #9: 20 分鐘

function analyzeForAutofix(report) {
  var issues = [];

  // npm audit moderate/low（Concern #2: critical 排除，需人工）
  if (report.npmAudit && report.npmAudit.total > 0 && report.npmAudit.vulnerabilities) {
    var fixable = report.npmAudit.vulnerabilities.filter(function(v) {
      return v.severity !== 'critical';
    });
    if (fixable.length > 0) {
      issues.push({ source: 'npmAudit', type: 'audit_fix', severity: 'moderate', count: fixable.length, detail: 'npm audit fix（排除 critical）' });
    }
  }

  // D1 query fail（表名/欄位過時）
  if (report.d1Stats && report.d1Stats.status === 'warning' && report.d1Stats.serverErrors > 100) {
    issues.push({ source: 'd1Stats', type: 'query_fail', severity: 'warning', detail: report.d1Stats.serverErrors + ' server errors in api_logs' });
  }

  // Stale requests（Concern #2: 對齊現有 1 小時門檻）
  if (report.requestErrors && report.requestErrors.staleCount > 0) {
    issues.push({ source: 'requestErrors', type: 'stale', severity: 'warning', count: report.requestErrors.staleCount, detail: '卡住的 request（>1 小時）' });
  }

  return issues;
}

function runAutofix(issues) {
  return new Promise(function(resolve) {
    // Guard: 檢查是否有遺留的 autofix PR
    try {
      var openPRs = execSync('gh pr list --search "daily-check-autofix" --state open --json number', { encoding: 'utf8', cwd: PROJECT_DIR, timeout: 10000 });
      if (JSON.parse(openPRs).length > 0) {
        resolve({ success: false, reason: 'existing_pr', detail: '昨天的 autofix PR 還沒 merge' });
        return;
      }
    } catch (e) {
      // gh 失敗不阻擋
    }

    // Concern #3: 具體的 Claude prompt，走 /tp-team pipeline
    var prompt = [
      '根據 daily-check 報告，用 /tp-team 修復以下問題：',
      JSON.stringify(issues, null, 2),
      '',
      '規則：',
      '- invoke /tp-team 開始，讓它自動路由',
      '- branch 名稱用 fix/daily-check-autofix-' + Date.now(),
      '- 只修報告中列出的問題，不要擴大範圍',
      '- 只允許修改 scripts/ 和 package*.json',
      '- /ship 時 PR title 用 "fix: daily-check 自動修復"',
      '- /ship 完成後跑 /land-and-deploy 自動 merge'
    ].join('\n');

    // Concern #4: 全部用 Node.js spawn
    var proc = spawn('/Users/ray/.local/bin/claude', [
      '--dangerously-skip-permissions',
      '-p', prompt
    ], {
      cwd: PROJECT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: Object.assign({}, process.env, {
        PATH: (process.env.PATH || '') + ':/Users/ray/.local/bin:/opt/homebrew/bin'
      })
    });

    var stdout = '';
    var stderr = '';
    proc.stdout.on('data', function(d) { if (stdout.length < 10000) stdout += d.toString(); });
    proc.stderr.on('data', function(d) { if (stderr.length < 5000) stderr += d.toString(); });

    var timer = setTimeout(function() {
      proc.kill('SIGTERM');
      setTimeout(function() { if (!proc.killed) proc.kill('SIGKILL'); }, 5000);
    }, AUTOFIX_TIMEOUT_MS);

    proc.on('close', function(code) {
      clearTimeout(timer);

      // Concern #8: 檢查 diff 是否超出預期範圍
      try {
        var diffStat = execSync('git diff --name-only HEAD', { encoding: 'utf8', cwd: PROJECT_DIR });
        var changedFiles = diffStat.trim().split('\n').filter(Boolean);
        var unexpected = changedFiles.filter(function(f) {
          return !f.startsWith('scripts/') && !f.startsWith('package') && f !== 'CLAUDE.md';
        });
        if (unexpected.length > 0) {
          execSync('git checkout .', { cwd: PROJECT_DIR });
          resolve({ success: false, reason: 'scope_violation', detail: '修改了預期外的檔案: ' + unexpected.join(', ') });
          return;
        }
      } catch (e) {}

      // 檢查 PR
      try {
        var prJson = execSync('gh pr list --author @me --state all --limit 1 --json url,state,title', { encoding: 'utf8', cwd: PROJECT_DIR, timeout: 10000 });
        var pr = JSON.parse(prJson)[0];
        resolve({ success: code === 0, prUrl: pr && pr.url, prState: pr && pr.state, prTitle: pr && pr.title });
      } catch (e) {
        resolve({ success: code === 0, reason: 'no_pr' });
      }
    });

    proc.on('error', function(err) {
      clearTimeout(timer);
      resolve({ success: false, reason: err.message });
    });
  });
}

// Concern #6: autofix 通知是獨立訊息，不取代 buildTelegramText
function buildAutofixTelegramText(issues, result) {
  var lines = [];

  if (result.success) {
    lines.push('🔧 <b>Tripline daily-check 自動修復</b>');
    lines.push('━━━━━━━━━━━━━━━');
    lines.push('修復 ' + issues.length + ' 個問題：');
    issues.forEach(function(i) { lines.push('• ' + i.detail); });
    lines.push('');
    if (result.prUrl) lines.push('PR: ' + result.prUrl);
    lines.push('狀態: ✅ 已送出（CI + auto-merge）');
  } else {
    lines.push('⚠️ <b>Tripline daily-check 修復失敗</b>');
    lines.push('━━━━━━━━━━━━━━━');
    lines.push('原因: ' + (result.detail || result.reason || 'unknown'));
    if (result.reason === 'existing_pr') {
      lines.push('動作: 請手動處理遺留的 autofix PR');
    } else if (result.reason === 'scope_violation') {
      lines.push('動作: Claude 修改了預期外的檔案，已 rollback');
    } else {
      lines.push('動作: 需要手動處理');
    }
  }

  lines.push('━━━━━━━━━━━━━━━');
  return lines.join('\n');
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
    queryRequestErrors(),    // 5
    queryD1Stats(),          // 6
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
  var requestErrors = val(5, { status: 'ok', total: 0, staleCount: 0, pending: [] });
  var d1Stats = val(6, { status: 'ok', totalLogs: 0, serverErrors: 0, clientErrors: 0, auditCount: 0 });

  var summary = calcSummary(sentry, apiErrors, encodingWarnings, workers, npmAuditResult, requestErrors, d1Stats);

  var report = {
    date: today,
    generatedAt: new Date().toISOString(),
    summary: summary,
    sentry: sentry,
    apiErrors: apiErrors,
    encodingWarnings: encodingWarnings,
    requestErrors: requestErrors,
    d1Stats: d1Stats,
    workers: workers,
    web: web,
    npmAudit: npmAuditResult
  };

  // 為所有 issue/error 項目加流水編號
  assignNums(report);

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
    if (env('TELEGRAM_BOT_TOKEN') && env('TELEGRAM_CHAT_ID')) {
      console.log('Telegram sent');
    }
  } catch (err) {
    console.error('Telegram send failed:', err.message);
  }

  // ── 自動修復階段 ──────────────────────────────────
  var autofixIssues = analyzeForAutofix(report);
  if (autofixIssues.length > 0) {
    console.log('Autofix: found ' + autofixIssues.length + ' fixable issues, starting...');
    try {
      var fixResult = await runAutofix(autofixIssues);
      console.log('Autofix result: ' + JSON.stringify(fixResult));

      // Concern #6: autofix 結果作為第二則 Telegram 訊息
      var autofixText = buildAutofixTelegramText(autofixIssues, fixResult);
      await sendTelegram(autofixText);
    } catch (err) {
      console.error('Autofix failed:', err.message);
      await sendTelegram('⚠️ <b>Autofix 異常</b>\n' + err.message).catch(function() {});
    }
  } else {
    console.log('Autofix: no fixable issues');
  }

  console.log('Daily check done — ' + JSON.stringify(summary));
}

main().catch(function(err) {
  console.error('Daily check failed:', err);
  process.exit(1);
});
