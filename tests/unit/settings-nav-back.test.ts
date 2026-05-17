/**
 * v2.31.39 fix — settings/dev sub-page navigation regression
 *
 * QA found 2026-05-17: `/settings/connected-apps` 缺 GlobalBottomNav + 缺
 * TitleBar back button；`/developer/apps` 缺 TitleBar back button（v2.31.34
 * fix #135 修了 nav 但漏 back）→ user 進去這兩頁無法返回 /account hub，
 * 必須用 browser back。
 *
 * Fix：兩頁 TitleBar 加 `back={() => navigate('/account')}`，ConnectedAppsPage
 * 補 AppShell bottomNav={<GlobalBottomNav authed={!!user} />}。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CONNECTED_APPS_SRC = readFileSync(
  resolve(__dirname, '../../src/pages/ConnectedAppsPage.tsx'),
  'utf8',
);
const DEVELOPER_APPS_SRC = readFileSync(
  resolve(__dirname, '../../src/pages/DeveloperAppsPage.tsx'),
  'utf8',
);

describe('v2.31.39 ConnectedAppsPage nav regression fix', () => {
  it('import GlobalBottomNav', () => {
    expect(CONNECTED_APPS_SRC).toMatch(
      /import GlobalBottomNav from ['"]\.\.\/components\/shell\/GlobalBottomNav['"];/,
    );
  });

  it('import useNavigate from react-router-dom', () => {
    expect(CONNECTED_APPS_SRC).toMatch(
      /import\s*\{[^}]*\buseNavigate\b[^}]*\}\s*from ['"]react-router-dom['"];/,
    );
  });

  it('AppShell 帶 bottomNav={<GlobalBottomNav authed=...>}', () => {
    expect(CONNECTED_APPS_SRC).toMatch(
      /bottomNav=\{<GlobalBottomNav\s+authed=\{[^}]+\}\s*\/>\}/,
    );
  });

  it('TitleBar 帶 back callback navigate /account', () => {
    expect(CONNECTED_APPS_SRC).toMatch(
      /<TitleBar\s+[^>]*title="已連結的應用"[^>]*back=\{[^}]+\}/s,
    );
    expect(CONNECTED_APPS_SRC).toMatch(/navigate\(['"]\/account['"]\)/);
  });
});

describe('v2.31.39 DeveloperAppsPage back button fix', () => {
  it('TitleBar 帶 back callback navigate /account', () => {
    // 既有 title 用 multiline JSX，allow 任意 prop 順序 + 多行
    expect(DEVELOPER_APPS_SRC).toMatch(/<TitleBar\b[\s\S]*?back=\{[^}]+\}[\s\S]*?\/>/);
    expect(DEVELOPER_APPS_SRC).toMatch(/navigate\(['"]\/account['"]\)/);
  });
});
