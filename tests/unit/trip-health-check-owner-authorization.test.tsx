/**
 * TripHealthCheckPage：旅伴看得到「請行程擁有者授權」（#1600）。鎖：
 *   - 旅伴 + 擁有者未授權 → 顯示說明、開始健檢鈕停用（不 POST health-check）
 *   - 旅伴 + 擁有者已授權、擁有者本人（未授權也不顯示旅伴說明）→ 照常可按
 *   - 查詢被拒 → 不攔
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const apiFetchRawMock = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetchRaw: (path: string, init?: RequestInit) => apiFetchRawMock(path, init),
}));
const USER = { id: 'u1', email: 'ray@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' };
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ user: USER, reload: () => {} }) }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: USER, reload: () => {} }) }));
vi.mock('../../src/hooks/useNavigateBack', () => ({ useNavigateBack: () => vi.fn() }));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import TripHealthCheckPage from '../../src/pages/TripHealthCheckPage';

const res = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function install(auth: { ownerAuthorized: boolean; isOwner: boolean } | 'reject') {
  apiFetchRawMock.mockReset();
  apiFetchRawMock.mockImplementation(async (path: string) => {
    if (path === '/trips/T1/ai-authorization') return auth === 'reject' ? res({ error: { code: 'PERM_DENIED' } }, 403) : res(auth);
    if (path.includes('/days?all=1')) return res([{ dayNum: 1, timeline: [{ id: 1 }] }]);
    if (path.includes('/health-check')) return res({ report: null });
    return res({ id: 'T1', title: '沖繩' });
  });
}
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/trip/T1/health']}>
      <Routes><Route path="/trip/:tripId/health" element={<TripHealthCheckPage />} /></Routes>
    </MemoryRouter>,
  );
}
const authCalled = () => apiFetchRawMock.mock.calls.some(([p]) => p === '/trips/T1/ai-authorization');
beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { cleanup(); });

describe('TripHealthCheckPage 旅伴的擁有者授權說明', () => {
  it('旅伴 + 擁有者未授權：顯示請行程擁有者授權，開始健檢停用', async () => {
    install({ ownerAuthorized: false, isOwner: false });
    renderPage();
    expect((await screen.findByTestId('ai-health-owner-unauthorized')).textContent).toContain('請行程擁有者授權');
    await waitFor(() => expect(screen.getByTestId('ai-health-empty')).toBeTruthy());
    expect((screen.getByTestId('ai-health-start-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('旅伴 + 擁有者已授權：不顯示說明，可開始健檢', async () => {
    install({ ownerAuthorized: true, isOwner: false });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('ai-health-empty')).toBeTruthy());
    await waitFor(() => expect(authCalled()).toBe(true));
    await waitFor(() => expect((screen.getByTestId('ai-health-start-btn') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByTestId('ai-health-owner-unauthorized')).toBeNull();
  });

  it('擁有者本人未授權：不顯示旅伴說明（行為不變）', async () => {
    install({ ownerAuthorized: false, isOwner: true });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('ai-health-empty')).toBeTruthy());
    await waitFor(() => expect(authCalled()).toBe(true));
    await waitFor(() => expect((screen.getByTestId('ai-health-start-btn') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByTestId('ai-health-owner-unauthorized')).toBeNull();
  });

  it('查詢被拒：不攔，不顯示說明', async () => {
    install('reject');
    renderPage();
    await waitFor(() => expect(screen.getByTestId('ai-health-empty')).toBeTruthy());
    await waitFor(() => expect(authCalled()).toBe(true));
    await waitFor(() => expect((screen.getByTestId('ai-health-start-btn') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByTestId('ai-health-owner-unauthorized')).toBeNull();
  });
});
