// @vitest-environment node
/**
 * v2.31.59 fix: LegacyRedirect 不再 hardcode 'okinawa-trip-2026-Ray' fallback。
 *
 * Bug：`const DEFAULT_TRIP = 'okinawa-trip-2026-Ray'` 是 admin（Ray）私有的
 * trip ID，當其他 user 走 unknown route 經 LegacyRedirect catch-all 會被
 * redirect 到非自己的 trip → /trips?selected=okinawa-trip-2026-Ray →
 * 403（非 owner / 沒 collab 權）。
 *
 * Fix：沒 valid `?trip=xxx` 就 redirect /trips（無 selected param 讓
 * TripsListPage fallback 到 user 最新編輯 trip 或 empty state）。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/entries/main.tsx'),
  'utf8',
);

describe('v2.31.59 LegacyRedirect no DEFAULT_TRIP hardcode', () => {
  it('DEFAULT_TRIP 常數已移除', () => {
    expect(SRC).not.toMatch(/const DEFAULT_TRIP\s*=/);
  });

  it('LegacyRedirect 沒 valid trip 就走 /trips（無 selected param）', () => {
    expect(SRC).toMatch(/<Navigate to="\/trips" replace \/>/);
  });

  it('LegacyRedirect 仍處理 valid ?trip=xxx legacy URL', () => {
    expect(SRC).toMatch(/\?trip=xxx\b|queryTrip && \/\^/);
    expect(SRC).toMatch(/\/trips\?selected=\$\{encodeURIComponent\(queryTrip\)\}/);
  });

  it('hardcoded admin trip id 已移出 executable code（comments 內仍可保留）', () => {
    // 移除 comment block 後再 grep — comment 內提及修了什麼 OK，但 executable
    // code (字串 literal / 常數 / props) 不該再出現。
    const codeOnly = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(codeOnly).not.toMatch(/okinawa-trip-2026-Ray/);
  });
});
