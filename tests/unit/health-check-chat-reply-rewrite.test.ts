// @vitest-environment node
/**
 * v2.31.18 fix #115: AI 健檢完成後 trip_requests.reply 應改寫為 user-friendly
 * summary，不應在 chat 顯示一大坨 raw JSON array。
 *
 * Prod QA found：assistant chat bubble 顯示
 *   [{"severity":"high","dimension":"distance","title":"Day 2 ..."}]
 * 完全沒人話，使用者完全看不懂。
 *
 * Fix：functions/api/requests/[id]/index.ts applyHealthCheckCompletion 在
 * UPDATE trip_health_reports 之後同時 UPDATE trip_requests SET reply = 短摘要 +
 * markdown link。原 raw findings 已存 trip_health_reports.findings_json。
 *
 * Pure-text grep（避開 D1 integration 跑 miniflare 的 overhead）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/requests/[id]/index.ts'),
  'utf8',
);

describe('v2.31.18 AI 健檢 chat reply 改寫', () => {
  it('完成 case：UPDATE trip_requests.reply 為 buildHealthCheckSummary 結果', () => {
    // applyHealthCheckCompletion 內 completed branch 須 call rewriteRequestReply
    const completedBranchMatch = SRC.match(
      /UPDATE trip_health_reports[\s\S]*?status = 'completed'[\s\S]*?\.run\(\);[\s\S]*?await rewriteRequestReply\(db, requestId, buildHealthCheckSummary\(findings, tripId\)\)/,
    );
    expect(completedBranchMatch).not.toBeNull();
  });

  it('失敗 case：UPDATE trip_requests.reply 為人話錯誤訊息', () => {
    // applyHealthCheckCompletion 內 failed branch 也須改寫 reply（避免原始 Claude error stack 進 chat）
    const failedBranchMatch = SRC.match(
      /status === 'failed'[\s\S]*?UPDATE trip_health_reports[\s\S]*?status = 'failed'[\s\S]*?\.run\(\);[\s\S]*?await rewriteRequestReply\(db, requestId, .*AI 健檢失敗/,
    );
    expect(failedBranchMatch).not.toBeNull();
  });

  it('buildHealthCheckSummary 空 findings 顯「沒發現問題」+ link', () => {
    expect(SRC).toMatch(/function buildHealthCheckSummary/);
    expect(SRC).toMatch(/AI 健檢完成 — 行程沒發現問題/);
    expect(SRC).toMatch(/前往健檢報告/);
    // markdown link path 對齊 frontend route /trip/:id/health
    expect(SRC).toMatch(/\/trip\/\$\{tripId\}\/health/);
  });

  it('buildHealthCheckSummary 有 findings 顯總數 + severity breakdown', () => {
    // 含 high/medium/low 分組計算
    expect(SRC).toMatch(/counts\.high/);
    expect(SRC).toMatch(/counts\.medium/);
    expect(SRC).toMatch(/counts\.low/);
    expect(SRC).toMatch(/發現 \$\{findings\.length\} 個 finding/);
  });

  it('rewriteRequestReply 只動 reply 一欄（不改其他 status / errors）', () => {
    const helperMatch = SRC.match(
      /async function rewriteRequestReply[\s\S]*?UPDATE trip_requests SET reply = \? WHERE id = \?/,
    );
    expect(helperMatch).not.toBeNull();
  });
});
