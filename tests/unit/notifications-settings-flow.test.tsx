import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    user: { id: 'u1', email: 'ray@example.com', emailVerified: true, displayName: 'Ray' },
    reload: () => {},
  }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', email: 'ray@example.com', emailVerified: true, displayName: 'Ray' },
    reload: () => {},
  }),
}));
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: vi.fn().mockResolvedValue({ tripCount: 0, totalDays: 0, collaboratorCount: 0 }),
  apiFetchRaw: vi.fn(),
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import AccountPage from '../../src/pages/AccountPage';
import NotificationsSettingsPage from '../../src/pages/NotificationsSettingsPage';

describe('notification settings availability', () => {
  it('labels the account entry, explains planned types as information, and returns to account', () => {
    render(
      <MemoryRouter initialEntries={['/account']}>
        <Routes>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/notifications" element={<NotificationsSettingsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: /通知設定.*尚未開放/ }));

    const page = screen.getByTestId('notifications-page');
    expect(within(page).getByRole('heading', { name: '通知功能尚未開放' })).toBeTruthy();
    expect(within(page).getByText(/以下是規劃中的通知類型，目前無法設定或接收通知/)).toBeTruthy();
    const planned = within(page).getByRole('list', { name: '規劃中的通知類型' });
    expect(within(planned).getAllByRole('listitem')).toHaveLength(3);
    expect(within(page).queryByRole('switch')).toBeNull();
    expect(within(page).queryByRole('checkbox')).toBeNull();

    fireEvent.click(within(page).getByRole('button', { name: '返回' }));
    expect(screen.getByTestId('account-page')).toBeTruthy();
  });
});
