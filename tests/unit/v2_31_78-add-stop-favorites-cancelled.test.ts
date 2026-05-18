/**
 * v2.31.78 fix: AddStopPage lazy favorites fetch 加 cancelled flag。
 *
 * 原本 useEffect 在 tab='favorites' && poiFavorites=null 觸發 fetch
 * `/api/poi-favorites`，但 setState 沒 guard — 切回 search tab 或 unmount
 * 期間若 fetch 還在 inflight，setPoiFavorites + setSavedLoading 會在 unmount
 * 後觸發 React state update warning + 殘留 closure 不 GC。
 *
 * Source-grep lock — 確認此 useEffect 區段含 `let cancelled = false` +
 * `return () => { cancelled = true; }` cleanup + 至少 1 個 `if (cancelled) return`
 * guard。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('v2.31.78: AddStopPage lazy favorites fetch has unmount guard', () => {
  const src = readFileSync(
    join(__dirname, '../../src/pages/AddStopPage.tsx'),
    'utf8',
  );

  it('lazy favorites useEffect declares cancelled flag', () => {
    // 找到 favorites useEffect 區段（包含 setSavedLoading + setPoiFavorites）
    const match = src.match(
      /useEffect\(\(\)\s*=>\s*{[\s\S]*?tab\s*!==\s*['"]favorites['"][\s\S]*?\}, \[tab, poiFavorites\]\);/,
    );
    expect(match, 'favorites useEffect block not found').toBeTruthy();
    const block = match![0];
    expect(block).toMatch(/let\s+cancelled\s*=\s*false/);
  });

  it('cleanup returns function that sets cancelled = true', () => {
    const match = src.match(
      /useEffect\(\(\)\s*=>\s*{[\s\S]*?tab\s*!==\s*['"]favorites['"][\s\S]*?\}, \[tab, poiFavorites\]\);/,
    );
    const block = match![0];
    expect(block).toMatch(/return\s*\(\)\s*=>\s*\{\s*cancelled\s*=\s*true/);
  });

  it('has cancelled guards before setPoiFavorites + setSavedLoading', () => {
    const match = src.match(
      /useEffect\(\(\)\s*=>\s*{[\s\S]*?tab\s*!==\s*['"]favorites['"][\s\S]*?\}, \[tab, poiFavorites\]\);/,
    );
    const block = match![0];
    // 至少 2 個 if (cancelled) return（try happy path + catch path）
    const guardMatches = block.match(/if\s*\(\s*cancelled\s*\)\s*return/g) ?? [];
    expect(guardMatches.length).toBeGreaterThanOrEqual(2);
    // finally setSavedLoading 也要 cancelled guard（不是直接 set）
    expect(block).toMatch(/if\s*\(\s*!cancelled\s*\)\s*setSavedLoading/);
  });
});
