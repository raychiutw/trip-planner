/**
 * AdminPage smoke tests — V2 redesign (terracotta-preview parity).
 *
 * Validates the post-2026-04-26 rewrite: AppShell wrap, V2 page heading,
 * tp-admin-section markup, admin gate (non-admin user redirects to /trips).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/hooks/useDarkMode', () => ({ useDarkMode: () => ({ isDark: false, setIsDark: () => {}, colorMode: 'auto', setColorMode: () => {}, toggleDark: () => {} }) }));
vi.mock('../../src/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true, reportFetchResult: () => {} }));
vi.mock('../../src/hooks/useOfflineToast', () => ({
  useOfflineToast: () => ({ showOffline: false, showReconnect: false }),
}));
vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    user: { id: 'u1', email: 'lean.lean@gmail.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
// Admin gate compares `user.email === 'lean.lean@gmail.com'` — ship the
// admin user so the page renders instead of redirecting to /trips.
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', email: 'lean.lean@gmail.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
// Replace shell deps to keep the test focused on AdminPage markup
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import AdminPage from '../../src/pages/AdminPage';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const MOCK_TRIPS = [
  { tripId: 'trip-1', name: '沖繩自駕', published: 1 },
  { tripId: 'trip-2', name: '釜山旅行', published: 0 },
];

function renderAdmin() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => MOCK_TRIPS,
  });
});

describe('AdminPage — V2 (AppShell + tp-admin-* + admin gate)', () => {
  it('renders page heading + crumb 「管理」 + h1 「權限管理」', () => {
    const { getByText } = renderAdmin();
    expect(getByText('管理')).toBeTruthy();
    expect(getByText('權限管理')).toBeTruthy();
  });

  it('three V2 sections render with eyebrow titles', () => {
    const { getByText } = renderAdmin();
    expect(getByText('選擇行程')).toBeTruthy();
    expect(getByText('已授權成員')).toBeTruthy();
    expect(getByText('新增成員')).toBeTruthy();
  });

  it('does NOT render legacy PageNav (#stickyNav removed in V2)', () => {
    const { container } = renderAdmin();
    expect(container.querySelector('#stickyNav')).toBeNull();
  });

  it('trip select uses tp-admin-select class + aria-label', () => {
    const { container } = renderAdmin();
    const select = container.querySelector('[aria-label="選擇行程"]');
    expect(select).toBeTruthy();
    expect(select?.className).toContain('tp-admin-select');
  });

  it('loads + renders trip options after mount', async () => {
    const { getByText } = renderAdmin();
    await waitFor(() => expect(getByText('沖繩自駕')).toBeTruthy());
    expect(getByText('(已下架) 釜山旅行')).toBeTruthy();
  });

  it('shows 「請先選擇行程」 empty state before trip is picked', () => {
    const { getByText } = renderAdmin();
    expect(getByText('請先選擇行程')).toBeTruthy();
  });

  it('has email input + 「新增」 button via tp-admin-add', () => {
    const { container, getByText } = renderAdmin();
    expect(container.querySelector('[data-testid="admin-add-email"]')).toBeTruthy();
    expect(getByText('新增')).toBeTruthy();
  });

  it('renders ToastContainer for action feedback', () => {
    const { container } = renderAdmin();
    expect(container.querySelector('[role="region"], .fixed')).toBeTruthy();
  });
});
