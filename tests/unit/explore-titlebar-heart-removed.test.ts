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
  it('底部 nav 仍 link /favorites（rev2：primary nav 由 sidebar 移到底部玻璃膠囊）', () => {
    const nav = readFileSync(
      join(__dirname, '../../src/components/shell/GlobalBottomNav.tsx'),
      'utf8',
    );
    expect(nav).toMatch(/href: '\/favorites'/);
  });

  it('bottom-nav 仍 link /favorites', () => {
    const bottomNav = readFileSync(
      join(__dirname, '../../src/components/shell/GlobalBottomNav.tsx'),
      'utf8',
    );
    expect(bottomNav).toMatch(/href: '\/favorites'/);
  });
});
