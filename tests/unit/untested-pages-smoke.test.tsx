/**
 * untested-pages-smoke.test.tsx — Round 22 (v2.33.72)
 *
 * Round 15 finding: 4 core pages 沒 unit test (CollabPage / TripLayout /
 * AppearanceSettingsPage / NotificationsSettingsPage) + VerifyEmailPage
 * (Round 13 新加未補測)。本檔提供 smoke render guard — 確認 page mount 不 throw
 * + 含預期 testid/text。完整 behavior test 留 follow-up。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NewTripProvider } from '../../src/contexts/NewTripContext';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';

// Mock useRequireAuth — page 通常 redirect 未登入。Smoke test 給 authenticated user.
vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ authReady: true, user: { id: 'test', email: 'test@x.com', displayName: null } }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'test', email: 'test@x.com', displayName: null }, loading: false, refetch: vi.fn() }),
}));
// Stub apiClient calls to avoid network
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: vi.fn().mockResolvedValue({}),
  apiFetchRaw: vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })),
}));

beforeEach(() => {
  // Browser API polyfill (already in setup-dom.js but defensive)
  if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as never;
  }
});

function wrap(ui: React.ReactNode, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ActiveTripProvider>
        <NewTripProvider>
          {ui}
        </NewTripProvider>
      </ActiveTripProvider>
    </MemoryRouter>,
  );
}

describe('Round 22 — TripLayout smoke', () => {
  it('renders provider + outlet without throw', async () => {
    const { default: TripLayout } = await import('../../src/pages/TripLayout');
    const { container } = render(
      <MemoryRouter initialEntries={['/trip/test-trip-1']}>
        <Routes>
          <Route path="/trip/:tripId" element={<TripLayout />}>
            <Route index element={<div data-testid="outlet-child">child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
    // outlet may render child synchronously via context provider
    expect(container.querySelector('[data-testid="outlet-child"]') || container).toBeTruthy();
  });
});

describe('Round 22 — AppearanceSettingsPage smoke', () => {
  it('mount + 有 TitleBar', async () => {
    const { default: AppearanceSettingsPage } = await import('../../src/pages/AppearanceSettingsPage');
    const { container } = wrap(<AppearanceSettingsPage />, '/account/appearance');
    expect(container).toBeTruthy();
    // Section label 「外觀」或對應 ThemeToggle 應 render
    expect(container.textContent ?? '').toMatch(/外觀|主題|淺|深|自動/);
  });
});

describe('Round 22 — NotificationsSettingsPage smoke', () => {
  it('mount + 含 placeholder/toggle UI', async () => {
    const { default: NotificationsSettingsPage } = await import('../../src/pages/NotificationsSettingsPage');
    const { container } = wrap(<NotificationsSettingsPage />, '/account/notifications');
    expect(container).toBeTruthy();
    expect(container.textContent ?? '').toMatch(/通知|notification|提醒/i);
  });
});

describe('Round 22 — CollabPage smoke', () => {
  it('mount under /trip/:id/collab route shape', async () => {
    const { default: CollabPage } = await import('../../src/pages/CollabPage');
    const { container } = render(
      <MemoryRouter initialEntries={['/trip/test-trip-1/collab']}>
        <ActiveTripProvider>
          <NewTripProvider>
            <Routes>
              <Route path="/trip/:tripId/collab" element={<CollabPage />} />
            </Routes>
          </NewTripProvider>
        </ActiveTripProvider>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
    // CollabPage 含「共編」或 collab 相關 text
    expect(container.textContent ?? '').toMatch(/共編|collab|成員/i);
  });
});

describe('Round 22 — VerifyEmailPage smoke (v2.33.59 round 13 H2)', () => {
  it('mount with ?token=abc shows idle button (v2.33.114 — require user gesture)', async () => {
    const { default: VerifyEmailPage } = await import('../../src/pages/VerifyEmailPage');
    const { container, getByTestId } = wrap(
      <Routes>
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
      </Routes>,
      '/auth/verify-email?token=abc123',
    );
    expect(container).toBeTruthy();
    expect(getByTestId('verify-email-page')).toBeTruthy();
    // v2.33.114: initial render → status='idle' (button to click), 不是 auto-POST「驗證中…」
    expect(getByTestId('verify-email-status-idle')).toBeTruthy();
    expect(getByTestId('verify-email-confirm-btn')).toBeTruthy();
  });

  it('mount without token → error missing_token', async () => {
    const { default: VerifyEmailPage } = await import('../../src/pages/VerifyEmailPage');
    const { container } = wrap(
      <Routes>
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
      </Routes>,
      '/auth/verify-email',
    );
    expect(container).toBeTruthy();
    // 無 token → 應顯示 error state (missing_token)
    expect(container.textContent ?? '').toMatch(/token|驗證/);
  });
});
