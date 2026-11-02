/**
 * DesktopSidebarConnected unit test — V2-P1
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DesktopSidebarConnected from '../../src/components/shell/DesktopSidebarConnected';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';

const SAMPLE_USER = {
  id: 'uid-1',
  email: 'me@example.com',
  emailVerified: true,
  displayName: 'My Name',
  avatarUrl: null,
  createdAt: '2026-04-25',
};

beforeEach(() => {
  vi.restoreAllMocks();
  __clearMyTripsCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderConnected() {
  return render(
    <MemoryRouter>
      <DesktopSidebarConnected />
    </MemoryRouter>,
  );
}

describe('DesktopSidebarConnected', () => {
  it('initial render (loading) does not show logged-out or account UI', () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
    const { container } = renderConnected();
    expect(container.querySelector('[data-testid="desktop-sidebar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="sidebar-user-loading"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="sidebar-user-chip"]')).toBeNull();
    expect(container.querySelector('[data-testid="sidebar-account-card"]')).toBeNull();

    // rev2：primary nav 已移底部膠囊；sidebar loading 不先渲染登入/未登入
    expect(container.textContent).not.toContain('未登入');
  });

  it('after fetch success renders user displayName (email row removed 2026-05-07)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_USER), { status: 200 }),
    );
    const { container } = renderConnected();
    await waitFor(() => {
      expect(container.textContent).toContain('My Name');
    });
    // 2026-05-07：email 從 sidebar account card 移除（保留在 /account hero）
    expect(container.textContent).not.toContain('me@example.com');
    expect(container.querySelector('[data-testid="sidebar-user-loading"]')).toBeNull();
  });

  it('v2.33.121: falls back to email local-part (not full email) when displayName is null', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ...SAMPLE_USER, displayName: null }), { status: 200 }),
    );
    const { container } = renderConnected();
    // displayName=null → email='me@example.com' → name='me' (local-part)，與 AccountPage hero 一致
    await waitFor(() => expect(container.textContent).toContain('me'));
    // 不該再顯整 email
    expect(container.textContent).not.toContain('me@example.com');
  });

  it('401 response → renders confirmed unauthed sidebar', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 401 }),
    );
    const { container } = renderConnected();
    await waitFor(() => {
      expect(container.querySelector('[data-testid="sidebar-user-chip"]')).toBeTruthy();
    });
    // rev2：primary nav 移底部膠囊；guest sidebar 顯示「未登入」 chip
    expect(container.textContent).toContain('未登入');
    expect(container.textContent).not.toContain('me@example.com');
  });

  it('renders DesktopSidebar after user fetch succeeds', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_USER), { status: 200 }),
    );
    const { container } = render(
      <MemoryRouter>
        <DesktopSidebarConnected />
      </MemoryRouter>,
    );
    // 2026-05-07：sidebar 移除 email 後改驗 displayName 渲染
    await waitFor(() => expect(container.textContent).toContain('My Name'));
    expect(container.querySelector('[data-testid="desktop-sidebar"]')).toBeTruthy();
    // sidebar 不再有「+ 新增行程」按鈕（入口改在 TripsListPage / GlobalMap empty state）
    expect(container.querySelector('[data-testid="sidebar-new-trip-btn"]')).toBeNull();
  });
});
