/**
 * v2.31.90：桌機 TitleBar action 全 icon-only（user direction「檢查桌機版 title bar
 * 都改為 icon 無說明文字」）。
 *
 * CSS `.tp-titlebar-action-label { display: none }` 從 mobile-only @media 改 always
 * hidden，所有 viewport 都 icon-only。每個 button 補 title attr 給 hover tooltip。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

describe('v2.31.90: 桌機 TitleBar action icon-only + title tooltip', () => {
  it('CSS .tp-titlebar-action-label display:none 在 @media (max-width:760px) 外（all viewport）', () => {
    const css = read('css/tokens.css');
    // rule 必須在 @media (max-width: 760px) 之前定義（top-level，all viewport apply）
    const labelRuleIdx = css.indexOf('.tp-titlebar-action-label { display: none; }');
    expect(labelRuleIdx, 'rule must exist as one-liner').toBeGreaterThan(0);
    // 看 .tp-titlebar-action 後第一個 @media (max-width: 760px) — label rule 應比它早出現
    const actionRuleIdx = css.indexOf('.tp-titlebar-action {');
    expect(actionRuleIdx).toBeGreaterThan(0);
    const nextMediaIdx = css.indexOf('@media (max-width: 760px)', actionRuleIdx);
    expect(nextMediaIdx).toBeGreaterThan(actionRuleIdx);
    expect(labelRuleIdx, 'label rule 必須出現在 .tp-titlebar-action 跟 @media (max-width:760px) 之間（top-level @media 外）').toBeGreaterThan(actionRuleIdx);
    expect(labelRuleIdx, 'label rule 必須出現在 @media block 之前 = top-level').toBeLessThan(nextMediaIdx);
  });

  it('TripsListPage 新增行程 button 有 title="新增行程"', () => {
    const src = read('src/pages/TripsListPage.tsx');
    expect(src).toMatch(/title="新增行程"/);
    expect(src).toMatch(/data-testid="trips-list-new-trip-titlebar"/);
  });

  it('SessionsPage 登出其他裝置 button 有 title attr', () => {
    const src = read('src/pages/SessionsPage.tsx');
    expect(src).toMatch(/data-testid="sessions-revoke-all"[\s\S]{0,200}|title="登出其他全部裝置"[\s\S]{0,200}data-testid="sessions-revoke-all"/);
    // 直接 grep title attr 存在
    expect(src).toMatch(/title="登出其他全部裝置"/);
  });

  it('DeveloperAppsPage 建立新應用 button 有 title="建立新應用"', () => {
    const src = read('src/pages/DeveloperAppsPage.tsx');
    expect(src).toMatch(/title="建立新應用"/);
  });

  it('TitleBarPrimaryAction 有 title={displayLabel}（reusable 給多 page）', () => {
    const src = read('src/components/shell/TitleBarPrimaryAction.tsx');
    expect(src).toMatch(/title=\{displayLabel\}/);
  });

  it('PoiFavoritesPage 既有 title 仍 in place (regression check)', () => {
    // v2.33.140: ExplorePage 收藏 action 拔除（back ← 已回 /favorites 重複入口），
    // 但 PoiFavoritesPage 探索 action 保留（從 favorites 到 explore 無 back path）。
    const favoritesPage = read('src/pages/PoiFavoritesPage.tsx');
    expect(favoritesPage).toMatch(/title="探索"/);
  });
});
