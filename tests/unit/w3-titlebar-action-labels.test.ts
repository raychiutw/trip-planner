/**
 * W3（owner 2026-07-24）：桌機 TitleBar action 恢復 icon + 可見文字 label。
 *
 * 正式推翻 v2.31.90「桌機 title bar 都 icon-only 無說明文字」的 owner 裁定
 * （AskUserQuestion，Ray 選「改回 icon + 可見 label」）。HIG header 慣例：動作鈕帶
 * 可見文字、可辨識。手機 (<=760) 仍 icon-only 圓形（label 於 mobile @media 隱藏）。
 *
 * lock：`.tp-titlebar-action-label` display 預設 inline（桌機顯示），只在
 * `@media (max-width:760px)` 內 display:none（手機隱藏）。title attr tooltip 保留
 * （桌機 hover 也給得起，非唯一語意來源）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

describe('W3: 桌機 TitleBar action icon + 可見 label（推翻 v2.31.90 icon-only）', () => {
  it('CSS label 桌機顯示：top-level display:inline，非 display:none', () => {
    const css = read('css/tokens.css');
    expect(css).toMatch(/\.tp-titlebar-action-label \{ display: inline; \}/);
    const inlineIdx = css.indexOf('.tp-titlebar-action-label { display: inline; }');
    const mediaIdx = css.indexOf('@media (max-width: 760px)', css.indexOf('.tp-titlebar-action {'));
    expect(inlineIdx).toBeGreaterThan(0);
    expect(mediaIdx).toBeGreaterThan(inlineIdx);
  });

  it('CSS label 手機隱藏：display:none 在 @media (max-width:760px) 內', () => {
    const css = read('css/tokens.css');
    const actionIdx = css.indexOf('.tp-titlebar-action {');
    const mediaIdx = css.indexOf('@media (max-width: 760px)', actionIdx);
    const mediaBlock = css.slice(mediaIdx, mediaIdx + 400);
    expect(mediaBlock).toMatch(/\.tp-titlebar-action-label \{ display: none; \}/);
  });

  it('icon-only 變體仍不顯 label（漢堡/kebab 無文字 trigger）', () => {
    const css = read('css/tokens.css');
    expect(css).toMatch(/\.tp-titlebar-action--icon-only \.tp-titlebar-action-label \{ display: none; \}/);
  });

  // title attr tooltip 保留（桌機 hover 也有用；不是唯一語意來源，但保著不移除）。
  it('TripsListPage 新增行程 button 有 title + testid（tooltip 保留）', () => {
    const src = read('src/pages/TripsListPage.tsx');
    expect(src).toMatch(/title="新增行程"/);
    expect(src).toMatch(/data-testid="trips-list-new-trip-titlebar"/);
  });

  it('SessionsPage 登出其他裝置 button title 保留', () => {
    const src = read('src/pages/SessionsPage.tsx');
    expect(src).toMatch(/title="登出其他全部裝置"/);
  });

  it('DeveloperAppsPage 建立新應用 button title 保留', () => {
    const src = read('src/pages/DeveloperAppsPage.tsx');
    expect(src).toMatch(/title="建立新應用"/);
  });

  it('TitleBarPrimaryAction 有 title={displayLabel}（reusable 給多 page）', () => {
    const src = read('src/components/shell/TitleBarPrimaryAction.tsx');
    expect(src).toMatch(/title=\{displayLabel\}/);
  });

  it('PoiFavoritesPage 既有 title 仍 in place (regression check)', () => {
    const favoritesPage = read('src/pages/PoiFavoritesPage.tsx');
    expect(favoritesPage).toMatch(/title="探索"/);
  });
});
