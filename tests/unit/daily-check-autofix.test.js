/**
 * daily-check autofix + telegram 測試
 * 測試 analyzeForAutofix、buildAutofixTelegramText 的邏輯
 * 因為 daily-check.js 沒有 export，用 Function 提取測試
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 從 daily-check.js 提取可測試的函式
const src = fs.readFileSync(path.join(__dirname, '../../scripts/daily-check.js'), 'utf8');

// 提取 analyzeForAutofix
const analyzeMatch = src.match(/function analyzeForAutofix\(report\) \{[\s\S]*?\n\}/);
const analyzeForAutofix = new Function('report', analyzeMatch[0].replace('function analyzeForAutofix(report) {', '').replace(/\}$/, ''));

// 提取 buildAutofixTelegramText
const buildMatch = src.match(/function buildAutofixTelegramText\(issues, result\) \{[\s\S]*?\n\}/);
const buildAutofixTelegramText = new Function('issues', 'result', buildMatch[0].replace('function buildAutofixTelegramText(issues, result) {', '').replace(/\}$/, ''));

describe('analyzeForAutofix', () => {
  it('空報告回傳空陣列', () => {
    expect(analyzeForAutofix({})).toEqual([]);
  });

  it('npm audit moderate 漏洞觸發 autofix', () => {
    const report = {
      npmAudit: {
        total: 1,
        vulnerabilities: [{ name: 'foo', severity: 'moderate' }]
      }
    };
    const issues = analyzeForAutofix(report);
    expect(issues).toHaveLength(1);
    expect(issues[0].source).toBe('npmAudit');
    expect(issues[0].type).toBe('audit_fix');
  });

  it('npm audit low 漏洞觸發 autofix', () => {
    const report = {
      npmAudit: {
        total: 2,
        vulnerabilities: [
          { name: 'a', severity: 'low' },
          { name: 'b', severity: 'low' }
        ]
      }
    };
    const issues = analyzeForAutofix(report);
    expect(issues).toHaveLength(1);
    expect(issues[0].count).toBe(2);
  });

  it('npm audit critical 不觸發 autofix', () => {
    const report = {
      npmAudit: {
        total: 1,
        vulnerabilities: [{ name: 'danger', severity: 'critical' }]
      }
    };
    expect(analyzeForAutofix(report)).toEqual([]);
  });

  it('npm audit mixed — 只計 non-critical', () => {
    const report = {
      npmAudit: {
        total: 3,
        vulnerabilities: [
          { name: 'a', severity: 'critical' },
          { name: 'b', severity: 'moderate' },
          { name: 'c', severity: 'low' }
        ]
      }
    };
    const issues = analyzeForAutofix(report);
    expect(issues).toHaveLength(1);
    expect(issues[0].count).toBe(2);
  });

  it('npm audit total=0 不觸發', () => {
    const report = { npmAudit: { total: 0, vulnerabilities: [] } };
    expect(analyzeForAutofix(report)).toEqual([]);
  });

  it('stale requests 觸發 autofix', () => {
    const report = {
      requestErrors: { staleCount: 2 }
    };
    const issues = analyzeForAutofix(report);
    expect(issues).toHaveLength(1);
    expect(issues[0].source).toBe('requestErrors');
    expect(issues[0].type).toBe('stale');
  });

  it('staleCount=0 不觸發', () => {
    const report = {
      requestErrors: { staleCount: 0 }
    };
    expect(analyzeForAutofix(report)).toEqual([]);
  });

  it('d1Stats serverErrors 不觸發 autofix（歷史資料）', () => {
    const report = {
      d1Stats: { status: 'warning', serverErrors: 500 }
    };
    expect(analyzeForAutofix(report)).toEqual([]);
  });

  it('sentry 問題不觸發 autofix', () => {
    const report = {
      sentry: { status: 'warning', total: 10, issues: [] }
    };
    expect(analyzeForAutofix(report)).toEqual([]);
  });

  it('apiErrors 不觸發 autofix', () => {
    const report = {
      apiErrors: { status: 'critical', total: 900, errors: [] }
    };
    expect(analyzeForAutofix(report)).toEqual([]);
  });

  it('多個問題同時觸發', () => {
    const report = {
      npmAudit: {
        total: 1,
        vulnerabilities: [{ name: 'x', severity: 'moderate' }]
      },
      requestErrors: { staleCount: 3 }
    };
    const issues = analyzeForAutofix(report);
    expect(issues).toHaveLength(2);
    expect(issues[0].source).toBe('npmAudit');
    expect(issues[1].source).toBe('requestErrors');
  });
});

describe('buildAutofixTelegramText', () => {
  it('成功時包含修復摘要和 PR 連結', () => {
    const issues = [{ detail: 'npm audit fix' }];
    const result = { success: true, prUrl: 'https://github.com/test/pr/1' };
    const text = buildAutofixTelegramText(issues, result);
    expect(text).toContain('自動修復');
    expect(text).toContain('npm audit fix');
    expect(text).toContain('https://github.com/test/pr/1');
    expect(text).toContain('已送出');
  });

  it('成功但無 PR URL', () => {
    const issues = [{ detail: 'fix something' }];
    const result = { success: true };
    const text = buildAutofixTelegramText(issues, result);
    expect(text).toContain('自動修復');
    expect(text).not.toContain('PR:');
  });

  it('多個問題全部列出', () => {
    const issues = [
      { detail: 'npm audit fix' },
      { detail: '卡住的 request' }
    ];
    const result = { success: true, prUrl: 'https://example.com' };
    const text = buildAutofixTelegramText(issues, result);
    expect(text).toContain('修復 2 個問題');
    expect(text).toContain('npm audit fix');
    expect(text).toContain('卡住的 request');
  });

  it('失敗 — existing_pr', () => {
    const issues = [{ detail: 'test' }];
    const result = { success: false, reason: 'existing_pr', detail: '昨天的 PR 還沒 merge' };
    const text = buildAutofixTelegramText(issues, result);
    expect(text).toContain('修復失敗');
    expect(text).toContain('昨天的 PR 還沒 merge');
    expect(text).toContain('手動處理遺留的 autofix PR');
  });

  it('失敗 — scope_violation', () => {
    const issues = [{ detail: 'test' }];
    const result = { success: false, reason: 'scope_violation', detail: '修改了預期外的檔案: src/foo.ts' };
    const text = buildAutofixTelegramText(issues, result);
    expect(text).toContain('修復失敗');
    expect(text).toContain('預期外的檔案');
    expect(text).toContain('已 rollback');
  });

  it('失敗 — unknown reason', () => {
    const issues = [{ detail: 'test' }];
    const result = { success: false };
    const text = buildAutofixTelegramText(issues, result);
    expect(text).toContain('修復失敗');
    expect(text).toContain('unknown');
    expect(text).toContain('手動處理');
  });
});
