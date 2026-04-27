/**
 * DesktopSidebarConnected unit test — V2-P1
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DesktopSidebarConnected from '../../src/components/shell/DesktopSidebarConnected';

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
  it('initial render (loading) shows "未登入" placeholder (avoid flicker)', () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
    const { container } = renderConnected();
    // sidebar 渲染未登入 chip — "?" initial
    expect(container.querySelector('[data-testid="desktop-sidebar"]')).toBeTruthy();
  });

  it('after fetch success renders user displayName + email', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_USER), { status: 200 }),
    );
    const { container } = renderConnected();
    await waitFor(() => {
      expect(container.textContent).toContain('My Name');
    });
    expect(container.textContent).toContain('me@example.com');
  });

  it('falls back to email as name when displayName is null', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ...SAMPLE_USER, displayName: null }), { status: 200 }),
    );
    const { container } = renderConnected();
    await waitFor(() => expect(container.textContent).toContain('me@example.com'));
  });

  it('401 response → renders unauthed sidebar (no user chip)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 401 }),
    );
    const { container } = renderConnected();
    await waitFor(() => {
      // user 為 null → 「?」 initial 仍渲染
      expect(container.querySelector('[data-testid="desktop-sidebar"]')).toBeTruthy();
    });
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
    await waitFor(() => expect(container.textContent).toContain('me@example.com'));
    expect(container.querySelector('[data-testid="desktop-sidebar"]')).toBeTruthy();
    // sidebar 不再有「+ 新增行程」按鈕（入口改在 TripsListPage / GlobalMap empty state）
    expect(container.querySelector('[data-testid="sidebar-new-trip-btn"]')).toBeNull();
  });
});
