// @vitest-environment node
/**
 * v2.31.34 fix #135: DeveloperAppsPage 加 bottomNav prop（mobile 缺 5-tab nav）。
 *
 * Bug 取證（mobile prod QA）：/developer/apps mobile (375x812) screenshot 顯示
 * 底部沒 GlobalBottomNav 5-tab。其他 page（AccountPage / PoiFavoritesPage /
 * DeveloperAppNewPage 等）都傳 bottomNav prop，DeveloperAppsPage 漏。User 在這頁
 * 只能 back button，無法直接切其他 page。一致性 bug。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/DeveloperAppsPage.tsx'),
  'utf8',
);

describe('v2.31.34 DeveloperAppsPage mobile bottomNav', () => {
  it('import GlobalBottomNav', () => {
    expect(SRC).toMatch(/import GlobalBottomNav from '\.\.\/components\/shell\/GlobalBottomNav'/);
  });

  it('import useCurrentUser 取 user', () => {
    expect(SRC).toMatch(/useCurrentUser/);
  });

  it('AppShell 傳 bottomNav prop（GlobalBottomNav with authed）', () => {
    expect(SRC).toMatch(/bottomNav=\{<GlobalBottomNav authed=\{!!user\}\s*\/>\}/);
  });

  it('sidebar prop 維持 DesktopSidebarConnected（regression）', () => {
    expect(SRC).toMatch(/sidebar=\{<DesktopSidebarConnected\s*\/>\}/);
  });
});
