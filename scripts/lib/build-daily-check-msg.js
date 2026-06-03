#!/usr/bin/env node
/**
 * build-daily-check-msg.js — 從 daily-check report JSON 組裝 Telegram 訊息
 *
 * Usage: node scripts/lib/build-daily-check-msg.js <report.json> [fix-result.json]
 *
 * 抽自 daily-check-scheduler.sh build_telegram_msg() inline node。Cowork
 * migration 後 skill 用 Bash tool 呼此 helper。
 */
const fs = require('fs');

const reportPath = process.argv[2];
const fixResultPath = process.argv[3];

if (!reportPath) {
  console.error('Usage: build-daily-check-msg.js <report.json> [fix-result.json]');
  process.exit(1);
}

const r = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const today = r.date.slice(5).replace('-', '/');
const lines = [];
const issues = [];

if (r.apiErrors && r.apiErrors.total > 0) {
  const icon = r.apiErrors.status === 'critical' ? '🔴' : '⚠️';
  issues.push(`${icon} API errors: ${r.apiErrors.total} 筆`);
}
if (r.sentry && r.sentry.total > 0) {
  issues.push(`⚠️ Sentry: ${r.sentry.total} 筆`);
}
if (r.requestErrors && r.requestErrors.total > 0) {
  const sc = r.requestErrors.statusCounts || {};
  let line = `⚠️ 未完成請求: open:${sc.open || 0} processing:${sc.processing || 0} failed:${sc.failed || 0}`;
  if (r.requestErrors.stuckProcessing > 0) {
    line += ` (${r.requestErrors.stuckProcessing} 卡住>15m)`;
  }
  issues.push(line);
}
if (r.schedulerErrors && r.schedulerErrors.total > 0) {
  const parts = [];
  Object.keys(r.schedulerErrors.details).forEach((k) => {
    if (r.schedulerErrors.details[k] && r.schedulerErrors.details[k].count > 0) {
      parts.push(`${k} ${r.schedulerErrors.details[k].count} 筆`);
    }
  });
  issues.push(`⚠️ 排程錯誤: ${parts.join(', ')}`);
}
if (r.npmAudit && r.npmAudit.error) {
  issues.push(`🔴 npm audit 失敗: ${r.npmAudit.error}`);
} else if (r.npmAudit && r.npmAudit.total > 0) {
  const sc = r.npmAudit.severityCounts || {};
  const breakdown = [];
  ['critical', 'high', 'moderate', 'low'].forEach((k) => {
    if (sc[k] > 0) breakdown.push(`${k}:${sc[k]}`);
  });
  const icon = r.npmAudit.status === 'critical' ? '🔴' : '⚠️';
  issues.push(`${icon} npm: ${r.npmAudit.total} 個漏洞 (${breakdown.join(' ')})`);
}
if (r.dataHygiene && r.dataHygiene.error) {
  issues.push(`🔴 prod data hygiene 檢查失敗: ${r.dataHygiene.error}`);
} else if (r.dataHygiene && r.dataHygiene.total > 0) {
  issues.push(`⚠️ prod data hygiene: ${r.dataHygiene.total} 筆 test marker 殘留`);
}
// v2.31.96: Google Maps MTD 花費 — critical/warning 進 issue 列表
if (r.googleMapsQuota && r.googleMapsQuota.status === 'critical') {
  const q = r.googleMapsQuota;
  const lock = q.isLocked ? '（已自動鎖）' : '';
  issues.push(`🔴 Google Maps MTD: $${(q.mtdCost || 0).toFixed(2)} / $${q.budget || 200} (${(q.mtdPct || 0).toFixed(1)}%)${lock}`);
} else if (r.googleMapsQuota && r.googleMapsQuota.status === 'warning' && !r.googleMapsQuota.error) {
  const q = r.googleMapsQuota;
  issues.push(`🟡 Google Maps MTD: $${(q.mtdCost || 0).toFixed(2)} / $${q.budget || 200} (${(q.mtdPct || 0).toFixed(1)}%) — 剩 $${(q.remainingUsd || 0).toFixed(2)}`);
}

if (issues.length === 0) {
  lines.push(`📊 ${today} ✅ 全綠`);
} else {
  lines.push(`📊 Tripline 每日報告 ${today}`);
  lines.push('──────────────');
  issues.forEach((i) => lines.push(i));
}
lines.push('──────────────');
if (r.workers) {
  const p50 = Math.round((r.workers.p50 || 0) / 1000);
  const p99 = Math.round((r.workers.p99 || 0) / 1000);
  lines.push(`📈 Workers: ${(r.workers.requests || 0).toLocaleString()} req | err ${r.workers.errors || 0} 筆 | P50 ${p50}ms P99 ${p99}ms`);
}
if (r.web && ((r.web.visits || 0) + (r.web.pageViews || 0)) > 0) {
  lines.push(`📈 Analytics: ${r.web.visits} visits, ${r.web.pageViews} views`);
}
if (r.npmAudit && !r.npmAudit.error && r.npmAudit.total === 0) {
  lines.push('📈 npm: 0 個漏洞');
}
// v2.31.96: Google Maps MTD 花費也放 metrics block（critical/warning 已上 issue list，但仍顯數字 = 透明）
if (r.googleMapsQuota && !r.googleMapsQuota.error && typeof r.googleMapsQuota.mtdCost === 'number') {
  const q = r.googleMapsQuota;
  const pct = (q.mtdPct || 0).toFixed(1);
  lines.push(`💰 Google Maps MTD: $${q.mtdCost.toFixed(2)} / $${q.budget || 200} (${pct}%)`);
}
const okItems = [];
if (r.schedulerErrors && r.schedulerErrors.details) {
  Object.keys(r.schedulerErrors.details).forEach((k) => {
    if (r.schedulerErrors.details[k] && r.schedulerErrors.details[k].count === 0) okItems.push(k);
  });
}
if (okItems.length > 0) lines.push(`✅ OK: ${okItems.join(', ')}`);

// 附加修復結果（若 fix-result.json 存在）
if (fixResultPath && fs.existsSync(fixResultPath)) {
  try {
    const fr = JSON.parse(fs.readFileSync(fixResultPath, 'utf8'));
    if (fr.total === 0) {
      lines.push('🔧 無需修復');
    } else {
      const skipped = (fr.details || []).filter((d) => d.status === 'skipped').length;
      lines.push(`🔨 總計:${fr.total} 已處理:${fr.fixed} 不處理:${skipped}${fr.pr_url ? ` ${fr.pr_url}` : ''}`);
      if (fr.details) {
        fr.details.forEach((d) => {
          const icon = d.status === 'fixed' ? '✅' : d.status === 'skipped' ? '⏭️' : '❌';
          lines.push(`  ${icon} ${d.summary}`);
        });
      }
    }
  } catch (e) {
    lines.push(`⚠️ fix-result 解析失敗: ${e.message}`);
  }
}

console.log(lines.join('\n'));
