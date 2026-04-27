#!/usr/bin/env node
/**
 * auth-cleanup.js — V2-P6 retention sweep
 *
 * 每日清掉過期 auth_audit_log + session_devices row。Cloudflare Pages 沒原生
 * cron triggers，所以這支 script 由 launchd / cron 每日呼叫（同 daily-check.js
 * 的執行方式）。
 *
 * Retention 策略（per autoplan）：
 *   - auth_audit_log: 30 天 → DELETE WHERE created_at < datetime('now', '-30 days')
 *   - session_devices: revoked 後 30 天 OR last_seen 超過 30 天 → DELETE
 *
 * 註冊方式（launchd）：複製 com.tripline.auth-cleanup.plist 範本（見下方註解）
 *   到 ~/Library/LaunchAgents 並 launchctl load。
 *
 * 環境變數同 daily-check.js（CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, D1_DATABASE_ID）。
 */
'use strict';

var fs = require('fs');
var path = require('path');

function loadEnvLocal() {
  try {
    var envPath = path.join(__dirname, '..', '.env.local');
    var content = fs.readFileSync(envPath, 'utf8');
    var env = {};
    content.split('\n').forEach(function (line) {
      var m = line.match(/^(\w+)=(.+)/);
      if (m) env[m[1]] = m[2].trim();
    });
    return env;
  } catch (e) {
    return {};
  }
}

var localEnv = loadEnvLocal();
function envVar(key) { return process.env[key] || localEnv[key] || ''; }

var CF_TOKEN = envVar('CLOUDFLARE_API_TOKEN');
var CF_ACCOUNT = envVar('CF_ACCOUNT_ID');
var D1_DB = envVar('D1_DATABASE_ID');

if (!CF_TOKEN || !CF_ACCOUNT || !D1_DB) {
  console.error('[auth-cleanup] missing CLOUDFLARE_API_TOKEN / CF_ACCOUNT_ID / D1_DATABASE_ID');
  process.exit(2);
}

async function execD1(sql) {
  var url = 'https://api.cloudflare.com/client/v4/accounts/' + CF_ACCOUNT +
    '/d1/database/' + D1_DB + '/query';
  var res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + CF_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: sql }),
  });
  var json = await res.json();
  if (!json.success) {
    throw new Error('D1 query failed: ' + JSON.stringify(json.errors || json));
  }
  var meta = (json.result && json.result[0] && json.result[0].meta) || {};
  return meta.changes || 0;
}

(async function main() {
  var report = { auth_audit_log: 0, session_devices: 0, oauth_models: 0 };

  // 1. auth_audit_log — 30 天保留
  report.auth_audit_log = await execD1(
    "DELETE FROM auth_audit_log WHERE created_at < datetime('now', '-30 days')"
  );

  // 2. session_devices — revoked 後 30 天或 30 天無活動
  report.session_devices = await execD1(
    "DELETE FROM session_devices " +
    "WHERE (revoked_at IS NOT NULL AND revoked_at < datetime('now', '-30 days')) " +
    "   OR (revoked_at IS NULL AND last_seen_at < datetime('now', '-30 days'))"
  );

  // 3. oauth_models — 過期 row 也順便清（D1Adapter.sweepExpired 邏輯，cron 統一在這跑）
  report.oauth_models = await execD1(
    "DELETE FROM oauth_models WHERE expires_at < strftime('%s', 'now') * 1000"
  );

  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    skill: 'auth-cleanup',
    deleted: report,
  }));
})().catch(function (err) {
  console.error('[auth-cleanup] FAILED:', err.message);
  process.exit(1);
});
