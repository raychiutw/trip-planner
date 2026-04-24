/**
 * Placeholder pages smoke tests — B-P2 §6.1-6.4
 *
 * 4 個 sidebar nav 對應的 placeholder pages：ChatPage / GlobalMapPage / ExplorePage / LoginPage
 * 驗證 render 不 crash + 主要 heading + CTA link to /manage
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatPage from '../../src/pages/ChatPage';
import GlobalMapPage from '../../src/pages/GlobalMapPage';
import ExplorePage from '../../src/pages/ExplorePage';
import LoginPage from '../../src/pages/LoginPage';

function renderWithRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('§6.1 ChatPage placeholder', () => {
  it('render heading + CTA link to /manage', () => {
    const { getByTestId, getByRole } = renderWithRouter(<ChatPage />);
    expect(getByTestId('chat-page')).toBeTruthy();
    expect(getByRole('heading', { level: 1 }).textContent).toContain('聊天');
    const cta = getByRole('link') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/manage');
  });
});

describe('§6.2 GlobalMapPage placeholder（/map 全域，非 per-trip）', () => {
  it('render heading + CTA link to /manage', () => {
    const { getByTestId, getByRole } = renderWithRouter(<GlobalMapPage />);
    expect(getByTestId('global-map-page')).toBeTruthy();
    expect(getByRole('heading', { level: 1 }).textContent).toContain('地圖');
    const cta = getByRole('link') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/manage');
  });
});

describe('§6.3 ExplorePage placeholder', () => {
  it('render heading + CTA link to /manage', () => {
    const { getByTestId, getByRole } = renderWithRouter(<ExplorePage />);
    expect(getByTestId('explore-page')).toBeTruthy();
    expect(getByRole('heading', { level: 1 }).textContent).toContain('探索');
    const cta = getByRole('link') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/manage');
  });
});

describe('§6.4 LoginPage placeholder (Cloudflare Access 過渡期)', () => {
  it('render 「使用 Cloudflare Access 登入」heading + CTA link to /manage', () => {
    const { getByTestId, getByRole } = renderWithRouter(<LoginPage />);
    expect(getByTestId('login-page')).toBeTruthy();
    const heading = getByRole('heading', { level: 1 }).textContent ?? '';
    expect(heading).toContain('Cloudflare Access');
    const cta = getByRole('link') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/manage');
  });
});
