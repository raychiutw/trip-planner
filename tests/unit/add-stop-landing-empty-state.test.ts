// @vitest-environment node
/**
 * v2.31.55 fix: AddStopPage landing empty state 不再 gate 在 poiFavorites。
 *
 * Bug (prod QA found)：user 進 /add-stop 預設「搜尋」 tab + 「為你推薦」 category，
 * empty state hint「輸入關鍵字搜尋，或切到「收藏」 tab」之前 gate 在
 * `poiFavorites && poiFavorites.length > 0`。但 poiFavorites 只在 tab='favorites'
 * 才 lazy fetch（line 664-681）→ 搜尋 tab 預設 null → empty state 永不 render
 * → user 看到 blank page 完全沒 hint「該做什麼」。
 *
 * Fix：decouple empty state from poiFavorites state，搜尋 tab + query 空 +
 * category=all 一律顯示 hint。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/AddStopPage.tsx'),
  'utf8',
);

describe('v2.31.55 AddStopPage landing empty state', () => {
  it('搜尋 tab + category=all + query 空 empty state 不再 gate 在 poiFavorites', () => {
    // 條件式 conjunctive group：searching=false + query.trim().length===0 + category==='all'
    // 後面直接 render 「輸入關鍵字搜尋」，不再有 `poiFavorites && poiFavorites.length > 0` gate
    const block = SRC.match(/!searching && query\.trim\(\)\.length === 0 && category === 'all'[^\n]*\n[\s\S]{0,300}?輸入關鍵字搜尋/);
    expect(block).not.toBeNull();
    // 確認該段 block 之前/條件式內沒有 poiFavorites 字樣（gate 已移除）
    if (block) {
      expect(block[0]).not.toMatch(/poiFavorites/);
    }
  });

  it('原本「輸入關鍵字搜尋，或切到「收藏」」 hint 仍存在', () => {
    expect(SRC).toMatch(/輸入關鍵字搜尋，或切到「收藏」 tab/);
  });

  it('其他 category empty state hint 維持原 logic（per-category 提示）', () => {
    expect(SRC).toMatch(/category !== 'all'/);
    expect(SRC).toMatch(/相關關鍵字開始搜尋/);
  });
});
