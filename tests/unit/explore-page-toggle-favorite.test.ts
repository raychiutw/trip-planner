// @vitest-environment node
/**
 * v2.31.43 fix #151: ExplorePage 已收藏 heart 改為可取消收藏。
 *
 * Bug 取證（prod QA loop）：
 *   - 搜尋結果 card heart icon 在 `isPoiFavorited === true` 時 `disabled`，
 *     onClick no-op (line 745-748)。
 *   - User 沒辦法在 explore page 取消收藏，必須切回 /favorites + 多步驟刪除。
 *   - 設計缺口：「已收藏」狀態應該 affordance 為「toggle off」而非「lock」。
 *
 * Fix：
 *   1. SavedKeyRow 加 `id: number` 欄位（要 reuse DELETE /poi-favorites/:id）。
 *   2. favoriteKeySet (Set<string>) → favoriteKeyMap (Map<string, number>)
 *      把 key → favorite row id 對應出來。
 *   3. handleSave → handleToggleFavorite，is-saved 分支走 DELETE。
 *   4. Heart button 拔掉 `disabled={isPoiFavorited}`；aria-label 改
 *      「已收藏 · 點擊取消」。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/ExplorePage.tsx'),
  'utf8',
);

describe('v2.31.43 ExplorePage heart toggle favorite', () => {
  it('SavedKeyRow 含 id 欄位（DELETE /poi-favorites/:id 必需）', () => {
    expect(SRC).toMatch(/interface SavedKeyRow \{[^}]*\bid:\s*number/);
  });

  it('favoriteKeyMap 用 Map<string, number> 取代 Set<string>', () => {
    expect(SRC).toMatch(/favoriteKeyMap\s*=\s*useMemo/);
    expect(SRC).toMatch(/new Map<string,\s*number>/);
  });

  it('heart click 不再 disabled in is-saved state（toggle 可用）', () => {
    // 拔掉 disabled={isSaving || isPoiFavorited} 模式；isSaving 仍 disable 防雙擊
    expect(SRC).not.toMatch(/disabled=\{isSaving\s*\|\|\s*isPoiFavorited\}/);
    expect(SRC).toMatch(/disabled=\{isSaving\}/);
  });

  it('heart aria-label 已收藏 state 顯「點擊取消」affordance', () => {
    expect(SRC).toMatch(/aria-label=\{isPoiFavorited \?\s*'已收藏[^']*點擊取消'/);
  });

  it('handleToggleFavorite 包 add + remove 分支', () => {
    expect(SRC).toMatch(/async function handleToggleFavorite/);
    expect(SRC).toMatch(/method:\s*'DELETE'/);
  });

  it('DELETE 用 favoriteKeyMap.get(key) 取 id 後 path 加 :id', () => {
    expect(SRC).toMatch(/`\/poi-favorites\/\$\{[^}]+\}`/);
  });
});
