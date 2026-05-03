/**
 * DeveloperAppNewPage unit test — V2-P4 + 2026-05-03 modal-to-fullpage migration
 *
 * 驗 page render + form validation + submit flow + secret reveal modal +
 * ack 後 navigate /developer/apps + dispatch tp-developer-app-created event。
 *
 * Cover 原本在 developer-apps-page.test.tsx 的 modal-flow tests (open/cancel/
 * submit-valid/public-no-secret/validation-too-short/validation-empty-uris)，
 * 全部改在 page 上 render。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' }, reload: () => {} }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' }, reload: () => {} }),
}));

import DeveloperAppNewPage from '../../src/pages/DeveloperAppNewPage';

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/developer/apps/new']}>
      <Routes>
        <Route path="/developer/apps/new" element={<DeveloperAppNewPage />} />
        <Route path="/developer/apps" element={<div data-testid="apps-list-stub">APPS LIST</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('DeveloperAppNewPage', () => {
  it('render page shell + form fields + TitleBar action button', () => {
    renderPage();
    expect(screen.getByTestId('dev-app-new-page')).toBeTruthy();
    expect(screen.getByTestId('dev-app-new-name')).toBeTruthy();
    expect(screen.getByTestId('dev-app-new-uris')).toBeTruthy();
    expect(screen.getByTestId('dev-app-new-type-public')).toBeTruthy();
    expect(screen.getByTestId('dev-app-new-type-confidential')).toBeTruthy();
    expect(screen.getByTestId('dev-app-new-scope-openid')).toBeTruthy();
    expect(screen.getByTestId('dev-app-new-titlebar-submit')).toBeTruthy();
    expect(screen.getByTestId('dev-app-new-submit')).toBeTruthy();
    expect(screen.getByTestId('dev-app-new-cancel')).toBeTruthy();
  });

  it('Default scopes: openid + profile + email checked, trips.* unchecked', () => {
    renderPage();
    const openid = screen.getByTestId('dev-app-new-scope-openid') as HTMLInputElement;
    const tripsRead = screen.getByTestId('dev-app-new-scope-trips.read') as HTMLInputElement;
    expect(openid.checked).toBe(true);
    expect(tripsRead.checked).toBe(false);
  });

  it('Submit valid form (confidential) → POST + show secret modal with client_secret', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(
      JSON.stringify({
        client_id: 'tp_new',
        client_secret: 'tps_secret123',
        app_name: 'New App',
        client_type: 'confidential',
        status: 'active',
        redirect_uris: ['https://x.com/cb'],
        allowed_scopes: ['openid', 'profile', 'email'],
      }),
      { status: 200 },
    ));
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    fireEvent.change(screen.getByTestId('dev-app-new-name'), { target: { value: 'New App' } });
    fireEvent.change(screen.getByTestId('dev-app-new-uris'), { target: { value: 'https://x.com/cb' } });
    fireEvent.click(screen.getByTestId('dev-app-new-type-confidential'));
    fireEvent.click(screen.getByTestId('dev-app-new-submit'));

    await waitFor(() => expect(screen.queryByTestId('dev-app-new-secret-modal')).toBeTruthy());
    expect(screen.getByTestId('dev-app-new-secret-client-id').textContent).toBe('tp_new');
    expect(screen.getByTestId('dev-app-new-secret-client-secret').textContent).toBe('tps_secret123');
  });

  it('Public client → no client_secret in result modal', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(
      JSON.stringify({
        client_id: 'tp_pub',
        client_secret: null,
        app_name: 'Public App',
        client_type: 'public',
        status: 'active',
        redirect_uris: ['https://x.com/cb'],
        allowed_scopes: ['openid'],
      }),
      { status: 200 },
    ));
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    fireEvent.change(screen.getByTestId('dev-app-new-name'), { target: { value: 'Public App' } });
    fireEvent.change(screen.getByTestId('dev-app-new-uris'), { target: { value: 'https://x.com/cb' } });
    fireEvent.click(screen.getByTestId('dev-app-new-submit'));

    await waitFor(() => expect(screen.queryByTestId('dev-app-new-secret-modal')).toBeTruthy());
    expect(screen.getByTestId('dev-app-new-secret-client-id')).toBeTruthy();
    expect(screen.queryByTestId('dev-app-new-secret-client-secret')).toBeNull();
  });

  it('Validation: app_name too short → inline error, no POST', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    fireEvent.change(screen.getByTestId('dev-app-new-name'), { target: { value: 'X' } });
    fireEvent.change(screen.getByTestId('dev-app-new-uris'), { target: { value: 'https://x.com/cb' } });
    fireEvent.click(screen.getByTestId('dev-app-new-submit'));

    await waitFor(() => expect(screen.queryByTestId('dev-app-new-error')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('Validation: empty redirect_uris → inline error, no POST', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    fireEvent.change(screen.getByTestId('dev-app-new-name'), { target: { value: 'My App' } });
    // leave redirect_uris empty
    fireEvent.click(screen.getByTestId('dev-app-new-submit'));

    await waitFor(() => expect(screen.queryByTestId('dev-app-new-error')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('Secret ack → dispatch tp-developer-app-created event + navigate /developer/apps', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(
      JSON.stringify({
        client_id: 'tp_done',
        client_secret: 'tps_x',
        app_name: 'Done App',
        client_type: 'confidential',
        status: 'active',
        redirect_uris: ['https://x.com/cb'],
        allowed_scopes: ['openid'],
      }),
      { status: 200 },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const eventSpy = vi.fn();
    window.addEventListener('tp-developer-app-created', eventSpy);

    renderPage();
    fireEvent.change(screen.getByTestId('dev-app-new-name'), { target: { value: 'Done App' } });
    fireEvent.change(screen.getByTestId('dev-app-new-uris'), { target: { value: 'https://x.com/cb' } });
    fireEvent.click(screen.getByTestId('dev-app-new-submit'));

    await waitFor(() => expect(screen.queryByTestId('dev-app-new-secret-modal')).toBeTruthy());
    fireEvent.click(screen.getByTestId('dev-app-new-secret-acknowledge'));

    await waitFor(() => expect(screen.queryByTestId('apps-list-stub')).toBeTruthy());
    expect(eventSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener('tp-developer-app-created', eventSpy);
  });

  it('Cancel → navigate back to /developer/apps (history fallback)', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('dev-app-new-cancel'));
    await waitFor(() => expect(screen.queryByTestId('apps-list-stub')).toBeTruthy());
  });

  it('POST 4xx error → inline error, no secret modal', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(
      JSON.stringify({ error: { code: 'invalid_redirect', message: '不接受 http://' } }),
      { status: 400 },
    ));
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    fireEvent.change(screen.getByTestId('dev-app-new-name'), { target: { value: 'Bad URI App' } });
    fireEvent.change(screen.getByTestId('dev-app-new-uris'), { target: { value: 'http://insecure.example/cb' } });
    fireEvent.click(screen.getByTestId('dev-app-new-submit'));

    await waitFor(() => expect(screen.queryByTestId('dev-app-new-error')).toBeTruthy());
    expect(screen.getByTestId('dev-app-new-error').textContent).toMatch(/不接受/);
    expect(screen.queryByTestId('dev-app-new-secret-modal')).toBeNull();
  });
});
