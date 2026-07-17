/**
 * rev2 手機統一 header 帳號圓圈 — 4 根 tab 頁都要有（regression: /qa 2026-07-18 發現
 * MapPage 漏，見 qa-report-rev2-shell-2026-07-18.md）。
 *
 * mockup「帳號 chip 屬於四個根 tab 頁的 titlebar」：聊天/行程/地圖/收藏。source-lock
 * 防未來有人從某根頁移除 <AccountCircle/>（帳號在手機唯一入口 → 移掉 = 手機無法到帳號）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function src(rel: string): string {
  return readFileSync(join(__dirname, '../../src', rel), 'utf8');
}

describe('rev2 手機帳號圓圈 — 4 根頁 header', () => {
  const ROOT_PAGES: Array<[string, string]> = [
    ['聊天', 'pages/ChatPage.tsx'],
    ['行程', 'pages/TripsListPage.tsx'],
    ['地圖', 'pages/MapPage.tsx'],
    ['收藏', 'pages/PoiFavoritesPage.tsx'],
  ];

  it.each(ROOT_PAGES)('%s 頁 import 並 render <AccountCircle/>', (_label, rel) => {
    const s = src(rel);
    expect(s).toMatch(/import AccountCircle from ['"]\.\.\/components\/shell\/AccountCircle['"]/);
    expect(s).toMatch(/account=\{<AccountCircle \/>\}/);
  });

  it('AccountCircle：authed → /account 首字母、anon → /login，桌機 CSS 隱藏', () => {
    const s = src('components/shell/AccountCircle.tsx');
    expect(s).toMatch(/to="\/account"/);
    expect(s).toMatch(/to="\/login"/);
    // 桌機隱藏（帳號在 sidebar chip），手機才顯
    expect(s).toMatch(/\.tp-account-circle\s*\{[\s\S]*?display:\s*none/);
    expect(s).toMatch(/@media \(max-width: 1023px\)[\s\S]*?\.tp-account-circle\s*\{\s*display:\s*grid/);
  });
});
