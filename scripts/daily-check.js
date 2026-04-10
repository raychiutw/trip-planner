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

var DAY_MS = 24 * 60 * 60 * 1000;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function pastDayWindow() {
  return {
    since: new Date(Date.now() - DAY_MS).toISOString(),
    until: new Date().toISOString()
  };
}

// ── CF GraphQL 共用 fetch helper ─────────────────────────────────

async function cfGraphQL(queryStr) {
  var res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + CF_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: queryStr })
  });
  if (!res.ok) throw new Error('CF GraphQL failed: ' + res.status);
  var data = await res.json();
  return data?.data?.viewer?.accounts?.[0] || null;
}

// ── 數據來源 1: Sentry 未解決 issues ────────────────────────────

async function querySentry() {
  var url = 'https://sentry.io/api/0/projects/' + SENTRY_ORG + '/' + SENTRY_PROJECT +
    '/issues/?query=' + encodeURIComponent('is:unresolved lastSeen:-24h');
  var res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + SENTRY_TOKEN }
  });
  if (!res.ok) throw new Error('Sentry API failed: ' + res.status);
  var issues = await res.json();

  var mapped = issues.map(function(i) {
    return {
      id: i.id,
      title: i.title,
      count: parseInt(i.count, 10) || 0,
      users: (i.userCount) || 0,
      lastSeen: i.lastSeen || '',
      link: i.permalink || ''
    };
  });

  return {
    status: mapped.length > 0 ? 'warning' : 'ok',
    total: mapped.length,
    issues: mapped
  };
}

// ── 數據來源 2: D1 api_logs — 昨日 4xx/5xx ──────────────────────

async function queryApiErrors() {
  // 過濾可預期的 auth/rate-limit 錯誤（401/403/429 屬正常流程）
  var rows = await queryD1(
    "SELECT path, method, status, COUNT(*) as count, MAX(created_at) as lastOccurred " +
    "FROM api_logs " +
    "WHERE created_at >= datetime('now', '-1 day') " +
    "  AND status >= 400 " +
    "  AND status NOT IN (401, 403, 429) " +
    "GROUP BY path, method, status " +
    "ORDER BY count DESC"
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
    errors: rows.slice(0, 20).map(function(r) {
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
  // 絕對 24h 避開 UTC 時區偏移
  var w = pastDayWindow();
  var query = '{ viewer { accounts(filter: {accountTag: "' + CF_ACCOUNT + '"}) { ' +
    'pagesFunctionsInvocationsAdaptiveGroups(limit: 10000, filter: { ' +
    'datetime_geq: "' + w.since + '", ' +
    'datetime_lt: "' + w.until + '" }) { ' +
    'sum { requests errors } ' +
    'quantiles { cpuTimeP50 cpuTimeP99 } ' +
    '} } } }';
  var account = await cfGraphQL(query);
  var row = account?.pagesFunctionsInvocationsAdaptiveGroups?.[0];
  return {
    requests: row?.sum?.requests ?? 0,
    errors: row?.sum?.errors ?? 0,
    p50: Math.round((row?.quantiles?.cpuTimeP50 ?? 0) * 10) / 10,
    p99: Math.round((row?.quantiles?.cpuTimeP99 ?? 0) * 10) / 10
  };
}

// ── 數據來源 5: Web Analytics ────────────────────────────────────

async function queryWebAnalytics() {
  var w = pastDayWindow();
  var query = '{ viewer { accounts(filter: {accountTag: "' + CF_ACCOUNT + '"}) { ' +
    'rumPageloadEventsAdaptiveGroups(limit: 1, filter: { ' +
    'datetime_geq: "' + w.since + '", ' +
    'datetime_lt: "' + w.until + '" }) { ' +
    'sum { visits pageViews } ' +
    '} } } }';
  var account = await cfGraphQL(query);
  var row = account?.rumPageloadEventsAdaptiveGroups?.[0];
  return {
    visits: row?.sum?.visits ?? 0,
    pageViews: row?.sum?.pageViews ?? 0
  };
}

// ── 數據來源 6: npm audit ────────────────────────────────────────

function queryNpmAudit() {
  try {
    var output = execSync('npm audit --json --omit=dev 2>/dev/null; true', {
      encoding: 'utf8',
      timeout: 60000,
      cwd: path.join(__dirname, '..')
    });
    var parsed = output.trim() ? JSON.parse(output) : {};

    var vulns = [];
    if (parsed.vulnerabilities) {
      Object.keys(parsed.vulnerabilities).forEach(function(pkgName) {
        var v = parsed.vulnerabilities[pkgName];
        if (v.severity && v.severity !== 'info') {
          vulns.push({ package: pkgName, severity: v.severity });
        }
      });
    }

    var severityCounts = { critical: 0, high: 0, moderate: 0, low: 0 };
    vulns.forEach(function(v) {
      if (severityCounts[v.severity] !== undefined) severityCounts[v.severity]++;
    });

    var status = vulns.length === 0
      ? 'ok'
      : (severityCounts.critical + severityCounts.high > 0 ? 'critical' : 'warning');

    return {
      status: status,
      total: vulns.length,
      severityCounts: severityCounts,
      vulnerabilities: vulns
    };
  } catch (err) {
    console.error('npm audit failed:', err.message);
    // Fail loud: critical + error message in Telegram
    return {
      status: 'critical',
      total: 0,
      severityCounts: { critical: 0, high: 0, moderate: 0, low: 0 },
      vulnerabilities: [],
      error: 'npm audit 執行失敗: ' + String(err.message || err).slice(0, 120)
    };
  }
}

// ── 數據來源 7: tp-request 錯誤統計 ─────────────────────────────

async function queryRequestErrors() {
  // 只看過去 24h 內的非 completed 請求（陳年 failed 會自然淡出）
  var rows = await queryD1(
    "SELECT id, trip_id, mode, status, substr(message, 1, 80) as message, " +
    "substr(reply, 1, 80) as reply, created_at " +
    "FROM trip_requests " +
    "WHERE status != 'completed' " +
    "  AND created_at >= datetime('now', '-1 day') " +
    "ORDER BY created_at DESC"
  );

  var statusCounts = { open: 0, processing: 0, failed: 0 };
  rows.forEach(function(r) {
    if (statusCounts[r.status] !== undefined) statusCounts[r.status]++;
  });

  // processing > 15min 視為卡住（Claude CLI 執行途中掛掉）
  var stuckCutoff = Date.now() - 15 * 60 * 1000;
  var stuckProcessing = rows.filter(function(r) {
    return r.status === 'processing' && new Date(r.created_at).getTime() < stuckCutoff;
  }).length;

  var status = rows.length > 0 ? 'warning' : 'ok';

  return {
    status: status,
    total: rows.length,
    statusCounts: statusCounts,
    stuckProcessing: stuckProcessing,
    pending: rows.slice(0, 20).map(function(r) {
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

// ── 數據來源 7: 排程 error log ────────────────────────────────

function querySchedulerErrors() {
  // 每 dir 最多收集 N 筆錯誤樣本顯示，但 count 記錄真實總數（不受上限影響）
  var MAX_ERROR_SAMPLES = 5;
  var MAX_MESSAGE_LEN = 100;
  var cutoff = new Date(Date.now() - DAY_MS);
  var baseDir = path.join(__dirname, 'logs');

  // error-log = cron scheduler（scheduler-common.sh log_error() → YYYY-MM-DD.error.log）
  // stderr    = long-running process（tripline-api-server → stderr.log，無時戳用 mtime 近似）
  var schedulers = [
    { name: 'tp-request',  type: 'error-log' },
    { name: 'daily-check', type: 'error-log' },
    { name: 'api-server',  type: 'stderr' },
  ];

  var details = {};
  var totalErrors = 0;

  schedulers.forEach(function(s) {
    var result = { count: 0, errors: [] };
    try {
      if (s.type === 'error-log') {
        var dirPath = path.join(baseDir, s.name);
        var files = fs.readdirSync(dirPath).filter(function(f) { return f.endsWith('.error.log'); });
        files.forEach(function(f) {
          var filePath = path.join(dirPath, f);
          var stat = fs.statSync(filePath);
          if (stat.mtime < cutoff) return;
          var content = fs.readFileSync(filePath, 'utf8').trim();
          if (!content) return;
          content.split('\n').forEach(function(line) {
            var match = line.match(/^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+Z?)?)\] \[error\] (.+)/);
            if (match) {
              var ts = new Date(match[1].replace(' ', 'T'));
              if (ts >= cutoff) {
                result.count++;
                if (result.errors.length < MAX_ERROR_SAMPLES) {
                  result.errors.push({ time: match[1], message: match[2].substring(0, MAX_MESSAGE_LEN) });
                }
              }
            }
          });
        });
      } else if (s.type === 'stderr') {
        // Long-running process 無時戳 stderr：用 mtime 近似「24h 內被寫入」，
        // 只讀檔尾 8KB 避免大檔案 OOM
        var stderrPath = path.join(baseDir, s.name, 'stderr.log');
        var stat = fs.statSync(stderrPath);
        if (stat.size > 0 && stat.mtime >= cutoff) {
          var tailSize = Math.min(stat.size, 8192);
          var buf = Buffer.alloc(tailSize);
          var fd = fs.openSync(stderrPath, 'r');
          try {
            fs.readSync(fd, buf, 0, tailSize, stat.size - tailSize);
          } finally {
            fs.closeSync(fd);
          }
          var lastLine = buf.toString('utf8').trim().split('\n').pop() || '';
          result.count = 1;
          result.errors = [{ time: '', message: lastLine.substring(0, MAX_MESSAGE_LEN) }];
        }
      }
    } catch (e) {
      // ENOENT = 檔案/目錄不存在 = 健康狀態，其他 error 才 log
      if (e.code !== 'ENOENT') {
        console.error('schedulerErrors scan failed for ' + s.name + ':', e.message);
      }
    }
    details[s.name] = result;
    totalErrors += result.count;
  });

  return {
    status: totalErrors > 0 ? 'warning' : 'ok',
    total: totalErrors,
    details: details
  };
}

// ── summary 計算 ────────────────────────────────────────────────

function calcSummary(sentry, apiErrors, npmAudit, requestErrors, schedulerErrors) {
  var sections = [sentry, apiErrors, npmAudit, requestErrors, schedulerErrors];
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

  report._maxNum = counter() - 1;
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
  var workers = val(2, { requests: 0, errors: 0, p50: 0, p99: 0 });
  var web = val(3, { visits: 0, pageViews: 0 });
  var requestErrors = val(4, { status: 'ok', total: 0, statusCounts: { open: 0, processing: 0, failed: 0 }, stuckProcessing: 0, pending: [] });

  var summary = calcSummary(sentry, apiErrors, npmAuditResult, requestErrors, schedulerErrors);

  var report = {
    date: today,
    generatedAt: new Date().toISOString(),
    summary: summary,
    sentry: sentry,
    apiErrors: apiErrors,
    requestErrors: requestErrors,
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
