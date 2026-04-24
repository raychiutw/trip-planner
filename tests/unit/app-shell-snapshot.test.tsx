/**
 * AppShell snapshot — B-P2 §2.6
 *
 * 三種 layout 結構固定 — snapshot 防止未來無意 regress slot 順序、className、data-layout。
 * Snapshot 排除 <style> 內容（CSS rules 已由 app-shell.test.tsx 字串斷言覆蓋）。
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AppShell from '../../src/components/shell/AppShell';

/** 抽出 .app-shell outerHTML（不含 <style> tag）讓 snapshot 聚焦 DOM 結構 */
function shellMarkup(container: HTMLElement): string {
  const node = container.querySelector('[data-testid="app-shell"]');
  return node ? node.outerHTML : '';
}

describe('AppShell snapshot', () => {
  it('§2.6 桌機 3-pane（sidebar + main + sheet + bottomNav 全 slot）', () => {
    const { container } = render(
      <AppShell
        sidebar={<div className="mock-sidebar">Sidebar</div>}
        main={<div className="mock-main">Main</div>}
        sheet={<div className="mock-sheet">Sheet</div>}
        bottomNav={<div className="mock-nav">BottomNav</div>}
      />,
    );
    expect(shellMarkup(container)).toMatchSnapshot();
  });

  it('§2.6 桌機 2-pane（sidebar + main，無 sheet 無 bottomNav）', () => {
    const { container } = render(
      <AppShell
        sidebar={<div className="mock-sidebar">Sidebar</div>}
        main={<div className="mock-main">Main</div>}
      />,
    );
    expect(shellMarkup(container)).toMatchSnapshot();
  });

  it('§2.6 手機典型（sidebar + main + bottomNav，無 sheet）', () => {
    const { container } = render(
      <AppShell
        sidebar={<div className="mock-sidebar">Sidebar</div>}
        main={<div className="mock-main">Main</div>}
        bottomNav={<div className="mock-nav">BottomNav</div>}
      />,
    );
    expect(shellMarkup(container)).toMatchSnapshot();
  });
});
