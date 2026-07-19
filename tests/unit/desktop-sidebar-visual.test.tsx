/**
 * DesktopSidebar visual (rev2 owner 2026-07-19, §10.1) — macOS sidebar 材質/token。
 * §10.3：sidebar 改 vibrancy 半透明毛玻璃（暖奶油，backdrop blur + color-mix 主背景），
 * 文字改用主 app token（--color-foreground/muted）自動 light/dark adapt。
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DesktopSidebar from '../../src/components/shell/DesktopSidebar';
import type { MyTrip } from '../../src/hooks/useMyTrips';

function renderSidebar(opts: {
  user?: { name: string; email: string } | null | undefined;
  initialEntry?: string;
  trips?: MyTrip[];
  activeTripId?: string | null;
}) {
  const user = Object.prototype.hasOwnProperty.call(opts, 'user') ? opts.user : null;
  const { initialEntry = '/trips' } = opts;
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DesktopSidebar user={user} trips={opts.trips} activeTripId={opts.activeTripId} />
    </MemoryRouter>,
  );
}

describe('DesktopSidebar rev2 — 帳號 chip', () => {
  it('auth loading 不顯示「未登入」或 account card，只 skeleton', () => {
    renderSidebar({ user: undefined, trips: [] });
    expect(screen.queryByText('未登入')).toBeNull();
    expect(screen.queryByTestId('sidebar-account-card')).toBeNull();
    expect(screen.getByTestId('sidebar-user-loading')).toBeTruthy();
  });

  it('account chip name >10 字 → slice(0,10)+「…」 truncation', () => {
    renderSidebar({ user: { name: '王大華王大華王大華王大華王大華王大華', email: 'long@x.com' }, trips: [] });
    const nameEl = screen.getByTestId('sidebar-account-card').querySelector('.tp-account-name');
    expect(nameEl?.textContent).toMatch(/…$/);
    expect((nameEl?.textContent ?? '').length).toBeLessThanOrEqual(11); // 10 + '…'
  });

  it('account chip name ≤10 字 → 不 truncation', () => {
    renderSidebar({ user: { name: 'Ray Chiu', email: 'ray@x.com' }, trips: [] });
    const nameEl = screen.getByTestId('sidebar-account-card').querySelector('.tp-account-name');
    expect(nameEl?.textContent).toBe('Ray Chiu');
  });

  it('account chip Link 指向 /account', () => {
    renderSidebar({ user: { name: 'Ray', email: 'ray@x.com' }, trips: [] });
    expect((screen.getByTestId('sidebar-account-card') as HTMLAnchorElement).getAttribute('href')).toBe('/account');
  });

  it('logged-out 顯示「未登入」 chip 取代 account card', () => {
    renderSidebar({ user: null, trips: [] });
    expect(screen.queryByTestId('sidebar-account-card')).toBeNull();
    expect(screen.getByTestId('sidebar-user-chip').textContent).toContain('未登入');
  });
});

describe('DesktopSidebar rev2 §10.1 — vibrancy 材質 + 清單視覺 token', () => {
  it('.tp-sidebar 用 vibrancy：backdrop-filter blur + color-mix(主背景) 半透明（無 body.dark override）', () => {
    const { container } = renderSidebar({ user: null, trips: [] });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-sidebar\s*\{[^}]*backdrop-filter:\s*blur/);
    expect(style).toMatch(/\.tp-sidebar\s*\{[^}]*background:\s*color-mix\([^}]*var\(--color-background\)/);
    // vibrancy 走主 app token 自動 light/dark adapt → 不需 body.dark 專段
    expect(style).not.toMatch(/body\.dark\s+\.tp-sidebar/);
  });

  it('trip item inactive 文字用 --color-muted token（vibrancy 後改主 app token）', () => {
    const { container } = renderSidebar({ user: null, trips: [] });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toContain('var(--color-muted)');
  });

  it('active trip item bg 用 accent', () => {
    const { container } = renderSidebar({ user: null, trips: [] });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-trip-item\.is-active\s*\{[^}]*background:\s*var\(--color-accent-fill\)/);
  });

  it('trip item font-weight 600', () => {
    const { container } = renderSidebar({ user: null, trips: [] });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-trip-item\s*\{[^}]*font-weight:\s*600/);
  });
});
