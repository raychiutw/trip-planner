/**
 * e2e-api-mocks-shape.test.ts — Round 25 (v2.33.75)
 *
 * Round 15 finding: tests/e2e/api-mocks.js 959 LOC 對 v2.21-v2.31 schema 大規模
 * drift。Audit 後修：savedAt → favoritedAt、移除 email、補 userId、註解更新。
 *
 * 此 test 鎖 source-grep 防 future regression — 未來再加 saved_at / email 等
 * 已 drop 欄位會立刻 fail。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MOCKS_FILE = readFileSync(join(process.cwd(), 'tests/e2e/api-mocks.js'), 'utf-8');

describe('Round 25 — e2e api-mocks schema parity', () => {
  it('不包含 deprecated 欄位 savedAt（v2.22.0 migration 0050 rename → favoritedAt）', () => {
    expect(MOCKS_FILE).not.toMatch(/savedAt:/);
  });

  it('不包含 deprecated 欄位 saved_at 作為 active code reference', () => {
    // 排除註解內的歷史說明（migration trail）。Active 使用 = property access 或 string literal。
    expect(MOCKS_FILE).not.toMatch(/\.saved_at\b/);
    expect(MOCKS_FILE).not.toMatch(/['"`]saved_at['"`]/);
  });

  it('poi_favorites mock row 帶 favoritedAt（對齊 backend deepCamel 結果）', () => {
    expect(MOCKS_FILE).toMatch(/favoritedAt:/);
  });

  it('poi_favorites mock 不再 leak email（v2.21.0 dropped poi_favorites.email）', () => {
    // poi_favorites mock row 內不應含 email field
    // 大致範圍：line ~770-800 (POST /api/poi-favorites 區段)
    const poiFavSection = MOCKS_FILE.match(/poi-favorites[\s\S]{0,1500}/);
    expect(poiFavSection).not.toBeNull();
    expect(poiFavSection![0]).not.toMatch(/^\s*email:\s+MOCK_USER\.email/m);
  });

  it('註解不再 reference saved_pois table（v2.29.1 migration 0063 DROP）作為 active concept', () => {
    // 註解可提及歷史（migration 0050/0063），但不應寫「我的收藏 (saved_pois)」
    // 暗示這仍是 active table name
    expect(MOCKS_FILE).not.toMatch(/「我的收藏」\n\/\/ \(saved_pois\)/);
  });

  it('沒留 trip_ideas active call site（function 已 retired）', () => {
    // 排除註解內的歷史記載；active call = `initialTripIdeas()` 或 `= initialTripIdeas`
    expect(MOCKS_FILE).not.toMatch(/=\s*initialTripIdeas\s*\(/);
    expect(MOCKS_FILE).not.toMatch(/function\s+initialTripIdeas\s*\(/);
  });
});
