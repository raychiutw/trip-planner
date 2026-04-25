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

describe('GlobalMapPage (V2 functional MVP — cross-trip leaflet)', () => {
  it('renders shell + map canvas + sheet', () => {
    const { getByTestId } = renderWithRouter(<GlobalMapPage />);
    expect(getByTestId('global-map-page')).toBeTruthy();
    expect(getByTestId('global-map-canvas')).toBeTruthy();
    expect(getByTestId('global-map-sheet')).toBeTruthy();
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
