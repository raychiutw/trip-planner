// @vitest-environment node
/**
 * v2.31.27 fix #128: AI 健檢 user message 在 chat 顯短摘要而非整個 system prompt。
 *
 * Bug 取證（prod QA）：trip_requests.message 是整個 HEALTH_CHECK_MESSAGE
 * （含 5 個審查維度 + JSON schema + 範例 + 「若行程無問題回 []」等）。
 * chat UI 直接 render row.message → user 看到一大坨 system prompt 雜訊。
 *
 * Fix：`src/pages/ChatPage.tsx` buildPairsFromRequest 偵測 message 開頭
 * `[AI 健檢]` → displayText 改「已觸發 AI 行程健檢」短摘要。完整 prompt
 * 仍存 trip_requests.message → api-server 拿到完整 text 送 Claude。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/ChatPage.tsx'),
  'utf8',
);

describe('v2.31.27 ChatPage AI 健檢 user message 簡化', () => {
  it('偵測 row.message 開頭 [AI 健檢]', () => {
    expect(SRC).toMatch(/row\.message\.startsWith\('\[AI 健檢\]'\)/);
  });

  it('短摘要為「已觸發 AI 行程健檢」', () => {
    expect(SRC).toMatch(/已觸發 AI 行程健檢/);
  });

  it('其他 message 維持原 row.message（regression）', () => {
    // displayText = isHealth ? summary : row.message
    expect(SRC).toMatch(/displayText[\s\S]{0,100}row\.message\.startsWith[\s\S]{0,200}: row\.message/);
  });

  it('user message 推進 out 用 displayText 而非 row.message', () => {
    // 該 push 應該用 displayText 變數
    const userPushMatch = SRC.match(/out\.push\(\{[\s\S]{0,200}role: 'user',[\s\S]{0,200}text: displayText/);
    expect(userPushMatch).not.toBeNull();
  });
});
