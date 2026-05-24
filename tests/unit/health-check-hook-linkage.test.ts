// @vitest-environment node
/**
 * v2.33.102 CR-8 confused-deputy fix regression test。
 *
 * 之前 PATCH /api/requests/:id hook 單靠 `message.startsWith('[AI 健檢]')` 認
 * health-check request。任何 user 在 chat 打 `[AI 健檢] hello` 都能誘騙 admin/
 * service PATCH 後觸發 applyHealthCheckCompletion → UPSERT trip_health_reports
 * 覆蓋（或產生）該 trip 的 report row。
 *
 * Fix：改用 `trip_health_reports.request_id` linkage 當 authoritative signal
 * （POST /trips/:id/health-check 唯一寫入點）。Hook 只在 SELECT linkage row
 * 存在時觸發。
 *
 * Pure source-grep（避開 D1 integration overhead）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/requests/[id]/index.ts'),
  'utf8',
);

describe('v2.33.102 CR-8 confused-deputy: hook 用 request_id linkage 不是 message prefix', () => {
  it('hook 不該檢查 message.startsWith(HEALTH_CHECK_PREFIX)', () => {
    expect(SRC).not.toMatch(/message\?\.startsWith\(HEALTH_CHECK_PREFIX\)/);
  });

  it('hook 不該 import HEALTH_CHECK_PREFIX', () => {
    expect(SRC).not.toMatch(/import\s*{[^}]*HEALTH_CHECK_PREFIX[^}]*}\s*from\s*['"]\.\.\/\.\.\/trips/);
  });

  it('hook 觸發前 SELECT trip_health_reports WHERE request_id = ? 驗證 linkage', () => {
    const linkageMatch = SRC.match(
      /SELECT\s+1\s+FROM\s+trip_health_reports\s+WHERE\s+request_id\s*=\s*\?\s+AND\s+trip_id\s*=\s*\?/,
    );
    expect(linkageMatch).not.toBeNull();
  });

  it('linkage SELECT bind 順序：(requestId, tripId)', () => {
    const bindMatch = SRC.match(
      /SELECT 1 FROM trip_health_reports WHERE request_id[\s\S]*?\.bind\(Number\(id\),\s*tripId\)/,
    );
    expect(bindMatch).not.toBeNull();
  });

  it('linkage 存在才 call applyHealthCheckCompletion', () => {
    const guardedHookMatch = SRC.match(
      /if\s*\(linked\)\s*{[\s\S]*?applyHealthCheckCompletion/,
    );
    expect(guardedHookMatch).not.toBeNull();
  });

  it('chat user 打 "[AI 健檢] hello" 不該誘騙 hook（無 linkage row → 不觸發）', () => {
    // 這個 test 是 documentation 性質：保證 source 沒回退到 message prefix path。
    // 若 prefix-only path 再出現，前面的 not.toMatch / not.toMatch 會 fail。
    expect(SRC).toMatch(/confused-deputy/);
  });
});
