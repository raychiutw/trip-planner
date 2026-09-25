import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AccountPage from '../../src/pages/AccountPage';
import NotificationsSettingsPage from '../../src/pages/NotificationsSettingsPage';
let requests: string[];
beforeEach(() => {
  requests = []; window.scrollTo = vi.fn(); localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), 'https://test').pathname; requests.push(path);
    return new Response(JSON.stringify(path === '/api/oauth/userinfo' ? { id: 'reader', email: 'reader@example.com', displayName: 'Reader' } : []));
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('labels the retained account entry as unavailable and presents plans as information with a return path', async () => {
  render(<MemoryRouter initialEntries={['/account']}><Routes><Route path="/account" element={<AccountPage />} /><Route path="/account/notifications" element={<NotificationsSettingsPage />} /></Routes></MemoryRouter>);
  const entry = await screen.findByTestId('account-row-notifications'); expect(entry).toHaveTextContent('尚未開放'); fireEvent.click(entry);
  const page = await screen.findByTestId('notifications-page'); expect(within(page).getByRole('heading', { name: '尚未開放' })).toBeInTheDocument();
  const plans = within(page).getByRole('list', { name: '規劃中的通知類型' }); expect(within(plans).getAllByRole('listitem')).toHaveLength(3);
  expect(within(plans).queryByRole('button')).not.toBeInTheDocument(); expect(within(page).queryByRole('switch')).not.toBeInTheDocument(); expect(within(page).queryByRole('checkbox')).not.toBeInTheDocument();
  fireEvent.click(within(page).getByRole('button', { name: '返回帳號' })); await screen.findByTestId('account-row-notifications');
  expect(requests.filter(path => path.includes('notifications'))).toEqual([]);
});
