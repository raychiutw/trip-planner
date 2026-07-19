/**
 * /explore titleBar heart 拔除 — v2.33.140
 *
 * User feedback 2026-05-28：「返回已經是回到收藏，不需要右上角的按鈕」。
 * back ← 已 wire goBack=useNavigateBack('/favorites')，右上 heart 是重複入口。
 *
 * /favorites page 仍保留 — 是 primary nav (sidebar + bottom-nav 兩處 link)，
 * user 條件「沒被其他頁面連結則可刪除」不成立。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const EXPLORE = readFileSync(
  join(__dirname, '../../src/pages/ExplorePage.tsx'),
  'utf8',
);

describe('/explore titleBar right action 拔除', () => {
  it('TitleBar 無 actions prop', () => {
    // 取 `<TitleBar ... />` 主 JSX block，確認沒 actions= 屬性
    const tbMatch = EXPLORE.match(/<TitleBar[\s\S]{0,400}?\/>/);
    expect(tbMatch).toBeTruthy();
    expect(tbMatch![0]).not.toMatch(/actions=/);
  });

  it('explore-favorites-titlebar testid 不再存在', () => {
    expect(EXPLORE).not.toMatch(/data-testid="explore-favorites-titlebar"/);
  });

  it('TitleBar 仍保留 back + backLabel', () => {
    expect(EXPLORE).toMatch(/<TitleBar[\s\S]*?back=\{goBack\}[\s\S]*?backLabel="返回收藏"[\s\S]*?\/>/);
  });

  it('useNavigateBack 仍 wire 到 /favorites (back ← 工作)', () => {
    expect(EXPLORE).toMatch(/const goBack = useNavigateBack\('\/favorites'\)/);
  });

  it('注解引用 v2.33.140 + user feedback', () => {
    expect(EXPLORE).toMatch(/v2\.33\.140.*不需要右上角的按鈕|不需要右上角.*v2\.33\.140/s);
  });
});

describe('/favorites page 仍保留 (其他地方仍 link)', () => {
  // rev2 §10.1（2026-07-19）：primary IA（含「收藏」→ /favorites）抽到 navItems 單一來源，
  // GlobalBottomNav（手機膠囊）+ DesktopSidebar（桌機 sidebar）共用；此鎖測改讀 navItems。
  it('primary nav（navItems）仍 link /favorites', () => {
    const navItems = readFileSync(
      join(__dirname, '../../src/components/shell/navItems.ts'),
      'utf8',
    );
    expect(navItems).toMatch(/href: '\/favorites'/);
  });

  it('「收藏」 tab active 覆蓋 /favorites 與 /explore（navItems FAVORITES_ACTIVE_PATTERNS）', () => {
    const navItems = readFileSync(
      join(__dirname, '../../src/components/shell/navItems.ts'),
      'utf8',
    );
    expect(navItems).toMatch(/\/\^\\\/explore/);
    expect(navItems).toMatch(/\/\^\\\/favorites\\\//);
  });
});
