// @vitest-environment node
/**
 * v2.34.38 prod audit fix: ChatPage user message 為 trip-notes feature 3 個 AI
 * prefix substitute 短摘要，不顯示 raw system prompt（JSON schema + 5-8 維度）。
 *
 * Bug 取證：prod /chat 顯示「Schema: ```json [{ "title": "string", ... }]」
 * 等內部 prompt template — trip_requests.message 是整個 AI prompt，沒被 chat
 * UI substitute 過。沿用 v2.31.27 起的 prefix substitution pattern。
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

describe('v2.34.38 ChatPage trip-notes AI prefix substitution', () => {
  it('偵測 row.message 開頭 [行程筆記-lodging-tips]', () => {
    expect(SRC).toMatch(/row\.message\.startsWith\('\[行程筆記-lodging-tips\]'\)/);
  });

  it('偵測 row.message 開頭 [行程筆記-tips]（一般行前須知）', () => {
    expect(SRC).toMatch(/row\.message\.startsWith\('\[行程筆記-tips\]'\)/);
  });

  it('偵測 row.message 開頭 [行程筆記-emergency]', () => {
    expect(SRC).toMatch(/row\.message\.startsWith\('\[行程筆記-emergency\]'\)/);
  });

  it('lodging-tips 短摘要包含「住宿在地建議」', () => {
    expect(SRC).toMatch(/已觸發 AI 行程筆記生成（住宿在地建議）/);
  });

  it('tips 短摘要包含「行前須知」', () => {
    expect(SRC).toMatch(/已觸發 AI 行程筆記生成（行前須知）/);
  });

  it('emergency 短摘要包含「緊急聯絡」', () => {
    expect(SRC).toMatch(/已觸發 AI 行程筆記生成（緊急聯絡）/);
  });

  it('[AI 健檢] 前綴替換保留（功能已移除，但歷史 chat 列仍需替換 raw health prompt）', () => {
    expect(SRC).toMatch(/row\.message\.startsWith\('\[AI 健檢\]'\)/);
    expect(SRC).toMatch(/已觸發 AI 行程健檢/);
  });
});
