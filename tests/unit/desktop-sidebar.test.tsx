/**
 * DesktopSidebar (rev2 owner 2026-07-19, §10.1) — 左欄 macOS sidebar：
 * primary nav（聊天/行程/地圖/收藏）+「我的行程」清單 + 帳號 chip 左下。
 * primary nav 從底部浮動玻璃膠囊搬回 sidebar 頂部（桌機膠囊隱藏）。
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DesktopSidebar from '../../src/components/shell/DesktopSidebar';
import type { MyTrip } from '../../src/hooks/useMyTrips';

const TRIPS: MyTrip[] = [
  { tripId: 'kyoto-5', name: '京都五日行' },
  { tripId: 'okinawa-7', name: '沖繩七日遊' },
];

function renderSidebar(opts: {
  path?: string;
  user?: { name: string; email: string } | null | undefined;
  trips?: MyTrip[];
  activeTripId?: string | null;
} = {}) {
  const user = Object.prototype.hasOwnProperty.call(opts, 'user')
    ? opts.user
    : { name: 'Ray', email: 'ray@example.com' };
  return render(
    <MemoryRouter initialEntries={[opts.path ?? '/trips']}>
      <DesktopSidebar user={user} trips={opts.trips} activeTripId={opts.activeTripId} />
    </MemoryRouter>,
  );
}

describe('DesktopSidebar rev2 — 我的行程清單', () => {
  it('brand 顯示 Tripline.', () => {
    const { container } = renderSidebar({ trips: [] });
    expect(container.querySelector('.tp-sidebar-brand')?.textContent).toContain('Tripline');
  });

  it('section label「我的行程」', () => {
    const { getByText } = renderSidebar({ trips: [] });
    expect(getByText('我的行程')).not.toBeNull();
  });

  it('trips=undefined → loading skeleton（不先渲染空態）', () => {
    const { container } = renderSidebar({ trips: undefined });
    expect(container.querySelector('.tp-sidebar-trips-loading')).not.toBeNull();
    expect(container.querySelector('.tp-sidebar-trips-empty')).toBeNull();
  });

  it('trips=[] → 空態「尚無行程」', () => {
    const { getByText, container } = renderSidebar({ trips: [] });
    expect(getByText('尚無行程')).not.toBeNull();
    expect(container.querySelector('.tp-sidebar-trips-loading')).toBeNull();
  });

  it('trips 清單 render 每個行程 name + /trips?selected= 連結', () => {
    const { getByTestId } = renderSidebar({ trips: TRIPS });
    const a = getByTestId('sidebar-trip-kyoto-5') as HTMLAnchorElement;
    expect(a.textContent).toContain('京都五日行');
    expect(a.getAttribute('href')).toBe('/trips?selected=kyoto-5');
  });

  it('activeTripId 對應行程套 .is-active + aria-current', () => {
    const { getByTestId } = renderSidebar({ trips: TRIPS, activeTripId: 'okinawa-7' });
    const active = getByTestId('sidebar-trip-okinawa-7');
    const inactive = getByTestId('sidebar-trip-kyoto-5');
    expect(active.classList.contains('is-active')).toBe(true);
    expect(active.getAttribute('aria-current')).toBe('page');
    expect(inactive.classList.contains('is-active')).toBe(false);
  });

  it('primary nav 在 sidebar 頂部：4-tab（聊天/行程/地圖/收藏）', () => {
    const { container, getByTestId } = renderSidebar({ trips: TRIPS });
    expect(container.querySelector('[aria-label="主要導覽"]')).not.toBeNull();
    expect(getByTestId('sidebar-nav-chat')).not.toBeNull();
    expect(getByTestId('sidebar-nav-trips')).not.toBeNull();
    expect(getByTestId('sidebar-nav-map')).not.toBeNull();
    expect(getByTestId('sidebar-nav-favorites')).not.toBeNull();
  });

  it('primary nav item href 正確（/chat /trips /map /favorites）', () => {
    const { getByTestId } = renderSidebar({ trips: TRIPS });
    expect((getByTestId('sidebar-nav-chat') as HTMLAnchorElement).getAttribute('href')).toBe('/chat');
    expect((getByTestId('sidebar-nav-trips') as HTMLAnchorElement).getAttribute('href')).toBe('/trips');
    expect((getByTestId('sidebar-nav-map') as HTMLAnchorElement).getAttribute('href')).toBe('/map');
    expect((getByTestId('sidebar-nav-favorites') as HTMLAnchorElement).getAttribute('href')).toBe('/favorites');
  });

  it('active nav：在 /chat「聊天」nav is-active，其餘不 active', () => {
    const { getByTestId } = renderSidebar({ path: '/chat', trips: TRIPS });
    expect(getByTestId('sidebar-nav-chat').className).toContain('is-active');
    expect(getByTestId('sidebar-nav-trips').className).not.toContain('is-active');
    expect(getByTestId('sidebar-nav-map').className).not.toContain('is-active');
  });

  it('active nav：在 /trip/okinawa/map「地圖」active、「行程」不 active（避免兩個同亮）', () => {
    const { getByTestId } = renderSidebar({ path: '/trip/okinawa/map', trips: TRIPS });
    expect(getByTestId('sidebar-nav-map').className).toContain('is-active');
    expect(getByTestId('sidebar-nav-trips').className).not.toContain('is-active');
  });
});

describe('DesktopSidebar rev2 — 帳號 chip（左下）', () => {
  it('user=undefined → auth loading skeleton', () => {
    const { getByTestId } = renderSidebar({ user: undefined, trips: [] });
    expect(getByTestId('sidebar-user-loading')).not.toBeNull();
  });

  it('user 已登入 → account card 顯示 name + 連 /account', () => {
    const { getByTestId } = renderSidebar({ user: { name: 'Ray', email: 'ray@example.com' }, trips: [] });
    const card = getByTestId('sidebar-account-card') as HTMLAnchorElement;
    expect(card.getAttribute('href')).toBe('/account');
    expect(card.textContent).toContain('Ray');
  });

  it('user=null → 未登入 chip', () => {
    const { getByTestId } = renderSidebar({ user: null, trips: [] });
    expect(getByTestId('sidebar-user-chip').textContent).toContain('未登入');
  });

  it('name > 10 CJK chars → slice(0,10)+…（CJK-safe）', () => {
    const { getByTestId } = renderSidebar({ user: { name: '一二三四五六七八九十十一', email: 'x@y.z' }, trips: [] });
    const card = getByTestId('sidebar-account-card');
    expect(card.textContent).toContain('一二三四五六七八九十…');
  });
});
