/**
 * Placeholder pages smoke tests — -6.4
 *
 * 4 個 sidebar nav 對應的 placeholder pages：ChatPage / GlobalMapPage / ExplorePage / LoginPage
 * 驗證 render 不 crash + 主要 heading + CTA link to /manage
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatPage from '../../src/pages/ChatPage';
import GlobalMapPage from '../../src/pages/GlobalMapPage';
import LoginPage from '../../src/pages/LoginPage';

function renderWithRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('ChatPage placeholder', () => {
  it('render heading + CTA link to /manage', () => {
    const { getByTestId, getByRole } = renderWithRouter(<ChatPage />);
    expect(getByTestId('chat-page')).toBeTruthy();
    expect(getByRole('heading', { level: 1 }).textContent).toContain('聊天');
    const cta = getByRole('link') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/manage');
  });
});

describe('GlobalMapPage placeholder（/map 全域，非 per-trip）', () => {
  it('render heading + CTA link to /manage', () => {
    const { getByTestId, getByRole } = renderWithRouter(<GlobalMapPage />);
    expect(getByTestId('global-map-page')).toBeTruthy();
    expect(getByRole('heading', { level: 1 }).textContent).toContain('地圖');
    const cta = getByRole('link') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/manage');
  });
});

describe('LoginPage (V2-P1 Google sign-in + CF Access 過渡期 fallback)', () => {
  it('render 「登入您的帳號」heading + Google login button + CF Access fallback', () => {
    const { getByTestId, getByRole } = renderWithRouter(<LoginPage />);
    expect(getByTestId('login-page')).toBeTruthy();
    const heading = getByRole('heading', { level: 1 }).textContent ?? '';
    expect(heading).toContain('登入');
    // Google login button
    const google = getByTestId('login-google') as HTMLAnchorElement;
    expect(google.getAttribute('href')).toBe('/api/oauth/authorize?provider=google');
    expect(google.textContent).toContain('Google');
    // CF Access fallback
    const cf = getByTestId('login-cf-access') as HTMLAnchorElement;
    expect(cf.getAttribute('href')).toBe('/manage');
    expect(cf.textContent).toContain('Cloudflare Access');
  });
});
