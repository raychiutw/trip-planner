/**
 * DesktopSidebar visual (rev2 owner 2026-07-17) — 我的行程清單 + 帳號 chip 視覺/token。
 * primary nav 已移底部浮動玻璃膠囊；此檔驗 sidebar surface token + 清單 active + 帳號 chip。
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

describe('DesktopSidebar rev2 — surface + 清單視覺 token', () => {
  it('.tp-sidebar bg 用 --color-sidebar-bg token（無 body.dark override）', () => {
    const { container } = renderSidebar({ user: null, trips: [] });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-sidebar\s*\{[^}]*background:\s*var\(--color-sidebar-bg\)/);
    expect(style).not.toMatch(/body\.dark\s+\.tp-sidebar/);
  });

  it('trip item inactive 文字用 --color-sidebar-fg-muted token', () => {
    const { container } = renderSidebar({ user: null, trips: [] });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toContain('var(--color-sidebar-fg-muted)');
  });

  it('active trip item bg 用 accent', () => {
    const { container } = renderSidebar({ user: null, trips: [] });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-trip-item\.is-active\s*\{[^}]*background:\s*var\(--color-accent\)/);
  });

  it('trip item font-weight 600', () => {
    const { container } = renderSidebar({ user: null, trips: [] });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-trip-item\s*\{[^}]*font-weight:\s*600/);
  });
});
