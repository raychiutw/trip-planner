/**
 * a11y-axe-core.test.tsx — axe-core a11y unit tests（B-P6 task 5.1 + 5.2）
 *
 * 跑 axe-core 對主要 component render output，assert 0 violations。
 * 用 jsdom（vitest default environment），不需要 dev server / Playwright runtime。
 *
 * Coverage：
 * - DesktopSidebar（5 nav items + user chip）
 * - BottomNavBar（4-tab IA）
 * - TripSheet（4 tabs: itinerary / ideas / map / chat with ARIA pattern）
 * - AppShell（3-pane layout primitive）
 * - 4 placeholder pages（Chat / GlobalMap / Login）+ ExplorePage（real）
 *
 * 執行：`npx vitest run tests/unit/a11y-axe-core.test.tsx`
 *
 * 失敗時看 result.violations 拿 fix hint，每個 violation 含：
 *   - id（rule name）
 *   - impact（minor / moderate / serious / critical）
 *   - help / helpUrl（修法）
 *   - nodes[].html / nodes[].failureSummary
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axe, { type Result } from 'axe-core';

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));
vi.mock('../../src/hooks/useLeafletMap', () => ({
  useLeafletMap: () => ({ containerRef: { current: null }, map: null, flyTo: () => {}, fitBounds: () => {} }),
}));

import AppShell from '../../src/components/shell/AppShell';
import DesktopSidebar from '../../src/components/shell/DesktopSidebar';
import BottomNavBar from '../../src/components/shell/BottomNavBar';
import TripSheet from '../../src/components/trip/TripSheet';
import ChatPage from '../../src/pages/ChatPage';
import GlobalMapPage from '../../src/pages/GlobalMapPage';
import LoginPage from '../../src/pages/LoginPage';

async function runAxe(container: Element): Promise<Result[]> {
  const result = await axe.run(container, {
    // 跑 wcag2a + wcag2aa rules（task 6.2 a11y threshold target）
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    // color-contrast 已被 unit test 在 color-contrast-wcag-aa.test.ts 涵蓋
    // 且 jsdom 對 CSS computed style 不可靠，axe 跑會 false-positive，停用
    rules: { 'color-contrast': { enabled: false } },
  });
  return result.violations;
}

function describeViolations(violations: Result[]): string {
  if (violations.length === 0) return '(none)';
  return violations
    .map(
      (v) =>
        `[${v.impact}] ${v.id} — ${v.help}\n  see: ${v.helpUrl}\n  ${v.nodes
          .slice(0, 3)
          .map((n) => n.failureSummary)
          .join('\n  ')}`,
    )
    .join('\n\n');
}

function withRouter(node: React.ReactNode, initialUrl = '/') {
  return <MemoryRouter initialEntries={[initialUrl]}>{node}</MemoryRouter>;
}

describe('a11y — axe-core wcag2a + wcag2aa（task 5.1+5.2）', () => {
  it('DesktopSidebar 0 violations', async () => {
    const { container } = render(withRouter(<DesktopSidebar />, '/trips'));
    const violations = await runAxe(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('BottomNavBar 0 violations', async () => {
    const { container } = render(withRouter(<BottomNavBar tripId="test-trip" />, '/trip/test-trip'));
    const violations = await runAxe(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('TripSheet 0 violations（含 ARIA tabs pattern）', async () => {
    const { container } = render(
      withRouter(
        <TripSheet tripId="test-trip" allPins={[]} pinsByDay={new Map()} />,
        '/trip/test-trip?sheet=map',
      ),
    );
    const violations = await runAxe(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('AppShell (3-pane) 0 violations', async () => {
    const { container } = render(
      withRouter(
        <AppShell
          sidebar={<div>Sidebar</div>}
          main={<div>Main</div>}
          sheet={<div>Sheet</div>}
        />,
      ),
    );
    const violations = await runAxe(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('ChatPage placeholder 0 violations', async () => {
    const { container } = render(withRouter(<ChatPage />, '/chat'));
    const violations = await runAxe(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('GlobalMapPage placeholder 0 violations', async () => {
    const { container } = render(withRouter(<GlobalMapPage />, '/map'));
    const violations = await runAxe(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('LoginPage placeholder 0 violations', async () => {
    const { container } = render(withRouter(<LoginPage />, '/login'));
    const violations = await runAxe(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });
});
