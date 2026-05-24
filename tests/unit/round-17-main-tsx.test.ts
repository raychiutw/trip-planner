/**
 * round-17-main-tsx.test.ts — v2.33.67 main.tsx lazyWithRetry bug fix
 *
 * Bug: `lazyWithRetry_reloaded` sessionStorage key 在 successful reload 後永遠
 * 殘留，下次同 tab 任何 chunk load fail 直接 reject 無 retry。Fix：mount 時清掉。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MAIN_TSX = readFileSync(
  path.resolve(__dirname, '../../src/entries/main.tsx'),
  'utf-8',
);

describe('v2.33.67 — main.tsx clears lazyWithRetry_reloaded on mount', () => {
  it('removeItem("lazyWithRetry_reloaded") 在 SW check 之前 (top-level)', () => {
    expect(MAIN_TSX).toMatch(/sessionStorage\.removeItem\('lazyWithRetry_reloaded'\)/);
    const cleanupIdx = MAIN_TSX.indexOf("sessionStorage.removeItem('lazyWithRetry_reloaded')");
    const swIdx = MAIN_TSX.indexOf("if ('serviceWorker' in navigator)");
    expect(cleanupIdx).toBeGreaterThan(-1);
    expect(swIdx).toBeGreaterThan(-1);
    expect(cleanupIdx).toBeLessThan(swIdx);
  });

  it('comment 解釋 retry budget 重置原因', () => {
    expect(MAIN_TSX).toMatch(/重試機制只能用一次|retry budget|每次 fresh load/);
  });
});
