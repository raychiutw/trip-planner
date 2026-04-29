/**
 * V2 functional smoke tests — ChatPage / GlobalMapPage / LoginPage
 *
 * These were placeholder smoke tests pre-implementation. Now that ChatPage
 * and GlobalMapPage ship functional V2 MVPs (composer + leaflet canvas),
 * the assertions check real entry points, not "Coming soon" CTAs.
 *
 * Heavy deps (sidebar / bottom nav / leaflet init / auth hooks) are mocked
 * — this file is for layout sanity, not full integration.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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

import ChatPage from '../../src/pages/ChatPage';
import GlobalMapPage from '../../src/pages/GlobalMapPage';
import LoginPage from '../../src/pages/LoginPage';

function renderWithRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('ChatPage (V2 functional MVP)', () => {
  it('renders shell + heading + composer (works with no trips loaded)', () => {
    const { getByTestId, getByRole } = renderWithRouter(<ChatPage />);
    expect(getByTestId('chat-page')).toBeTruthy();
    expect(getByRole('heading', { level: 1 }).textContent).toContain('聊天');
    expect(getByTestId('chat-input')).toBeTruthy();
    expect(getByTestId('chat-send')).toBeTruthy();
  });
});

describe('GlobalMapPage (v2.17.5 — sidebar /map redirect to trip-bound)', () => {
  /* 2026-04-29:GlobalMapPage 改為 render-前 conditional redirect。
   * 有 trip → <Navigate to=`/trip/:id/map` replace />(MemoryRouter 不會 render
   * 子 page,GlobalMapPage 不會 mount canvas)
   * 沒 trip → fall through 到 empty state「+ 建立第一個行程」CTA
   *
   * 此 test 驗 fall-through path:fetch 給空陣列 → empty state 渲染。 */
  it('沒 trip 時走 fall-through empty state(不 redirect)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as unknown as typeof fetch;
    const { findByTestId } = renderWithRouter(<GlobalMapPage />);
    expect(await findByTestId('global-map-empty')).toBeTruthy();
    expect(await findByTestId('global-map-new-trip')).toBeTruthy();
  });
});

describe('LoginPage (V2 password-first + optional Google — sole auth, no CF Access fallback)', () => {
  it('render 「登入」heading + signup link (Google gated on /api/public-config probe; CF Access link removed in cutover)', () => {
    const { getByTestId, queryByTestId, getByRole } = renderWithRouter(<LoginPage />);
    expect(getByTestId('login-page')).toBeTruthy();
    const heading = getByRole('heading', { level: 1 }).textContent ?? '';
    expect(heading).toContain('登入');
    // Self-signup link (primary V2 path per "先開放自建帳號")
    const signup = getByTestId('login-signup-link') as HTMLAnchorElement;
    expect(signup.getAttribute('href')).toBe('/signup');
    // Google login button is hidden until the public-config probe confirms env
    expect(queryByTestId('login-google')).toBeNull();
    // CF Access transitional link is REMOVED (V2 is sole auth post-cutover)
    expect(queryByTestId('login-cf-access')).toBeNull();
  });
});
