/**
 * use-require-auth.test.tsx — v2.33.39 round 4 test coverage
 *
 * Top-1 zero-test gap — auth gate on every protected route。Tests:
 * - user === undefined (loading) → 不 navigate
 * - user === null (unauth) → navigate '/login?redirect_after=<current>'
 * - user === CurrentUser (auth) → 不 navigate
 * - redirect_after 含 query / hash 正確 encode
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';

const mockNavigate = vi.fn();
const mockCurrentUser = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUser(),
}));

import { useRequireAuth } from '../../src/hooks/useRequireAuth';

function wrapper(initialPath: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockCurrentUser.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('useRequireAuth', () => {
  it('user === undefined (loading) → no navigate', async () => {
    mockCurrentUser.mockReturnValue({ user: undefined, reload: () => {} });
    renderHook(() => useRequireAuth(), { wrapper: wrapper('/manage') });
    // give effect chance to fire
    await new Promise((r) => setTimeout(r, 10));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('user === CurrentUser (auth) → no navigate', async () => {
    mockCurrentUser.mockReturnValue({
      user: { id: '1', email: 'x@y.z', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' },
      reload: () => {},
    });
    renderHook(() => useRequireAuth(), { wrapper: wrapper('/manage') });
    await new Promise((r) => setTimeout(r, 10));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('user === null → navigate to /login with encoded redirect_after', async () => {
    mockCurrentUser.mockReturnValue({ user: null, reload: () => {} });
    renderHook(() => useRequireAuth(), { wrapper: wrapper('/manage') });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/login?redirect_after=%2Fmanage',
        { replace: true },
      );
    });
  });

  it('redirect_after includes query string', async () => {
    mockCurrentUser.mockReturnValue({ user: null, reload: () => {} });
    renderHook(() => useRequireAuth(), { wrapper: wrapper('/manage?tab=members') });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/login?redirect_after=%2Fmanage%3Ftab%3Dmembers',
        { replace: true },
      );
    });
  });
});
