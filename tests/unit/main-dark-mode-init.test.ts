// @vitest-environment node
/**
 * v2.31.25 fix #126: dark mode root-level init。
 *
 * Bug 取證（prod QA）：
 *   - /account/appearance 切「深」mode → localStorage tp-color-mode = "dark" ✓
 *   - 切到 /trips → body.dark class 仍空 → page 還是 light bg
 *   - 原因：useDarkMode 只在 ThemeToggle / TripPage / GlobalMapPage 三處 mount，
 *     其他 page (trips/chat/favorites/explore/...) 都沒 init body.dark class
 *
 * Fix：加 root-level <DarkModeInit /> component（useDarkMode + return null）
 * mount 在 BrowserRouter 之下，確保每次 page mount 都 init body.dark from localStorage。
 *
 * Pure-text grep on main.tsx 確認 root init 存在 + 不會被未來 refactor 拔掉。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/entries/main.tsx'),
  'utf8',
);

describe('v2.31.25 dark mode root-level init', () => {
  it('main.tsx import useDarkMode', () => {
    expect(SRC).toMatch(/import \{ useDarkMode \} from '\.\.\/hooks\/useDarkMode'/);
  });

  it('DarkModeInit component 定義（call hook + return null）', () => {
    const match = SRC.match(/function DarkModeInit\(\)\s*\{[\s\S]*?useDarkMode\(\)[\s\S]*?return null[\s\S]*?\}/);
    expect(match).not.toBeNull();
  });

  it('root render 含 <DarkModeInit /> 在 BrowserRouter 之下', () => {
    // 必須 inside BrowserRouter（hook 可能依 router context）+ 在 routes 外（root level）
    // W1：主路由表由 <AccountModalRoutes> render-prop 包住（注入 location 給 Account sheet），
    // DarkModeInit 仍在其之前、BrowserRouter 之下。
    const browserRouterMatch = SRC.match(/<BrowserRouter>[\s\S]*?<DarkModeInit \/>[\s\S]*?<AccountModalRoutes>/);
    expect(browserRouterMatch).not.toBeNull();
  });
});
