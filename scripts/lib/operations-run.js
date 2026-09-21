'use strict';

/** Run real source adapters once; all consumers share completion and severity.
 * Transport, retries, timeouts and thresholds remain with each source adapter.
 */
async function runOperations(definitions, options = {}) {
  const entries = await Promise.all(Object.entries(definitions).map(async ([name, definition]) => {
    const base = { required: definition.required !== false, informational: !!definition.informational };
    try {
      const data = await definition.run();
      const assessment = definition.assess ? definition.assess(data) : {};
      return [name, { ...base, completion: 'complete', severity: 'ok', empty: false, data, ...assessment }];
    } catch (error) {
      return [name, { ...base, completion: 'failed', severity: definition.failureSeverity || 'warning', empty: false, data: null, error: String(error.message || error) }];
    }
  }));
  const sources = Object.fromEntries(entries);
  const required = Object.values(sources).filter((source) => source.required);
  const alerts = Object.values(sources).filter((source) => !source.informational);
  const completion = required.every((source) => source.completion === 'complete') ? 'complete'
    : required.some((source) => source.completion !== 'failed') ? 'partial' : 'failed';
  const critical = alerts.filter((source) => source.severity === 'critical').length;
  const warning = alerts.filter((source) => source.severity === 'warning').length;
  const empty = required.length === 0 || (completion === 'complete' && required.every((source) => source.empty));
  const summary = {
    completion, empty, healthy: completion === 'complete' && !empty && critical + warning === 0,
    severity: critical ? 'critical' : warning ? 'warning' : 'ok',
    totalIssues: critical + warning, critical, warning,
    ok: alerts.filter((source) => source.completion === 'complete' && source.severity === 'ok').length,
    incomplete: required.filter((source) => source.completion !== 'complete').length,
  };
  return { generatedAt: (options.now || (() => new Date()))().toISOString(), sources, summary };
}

function summaryText(summary) {
  const completion = summary.completion === 'partial' ? '部分完成'
    : summary.completion === 'failed' ? '全數查詢失敗' : summary.empty ? '檢查完成，零資料' : '檢查完整';
  return completion + (summary.healthy ? '；全部健康' : '；' + summary.critical + ' 項嚴重、' + summary.warning + ' 項警告');
}

module.exports = { runOperations, summaryText };
