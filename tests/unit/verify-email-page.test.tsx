import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import VerifyEmailPage from '../../src/pages/VerifyEmailPage';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderAt(query = '') {
  return render(
    <MemoryRouter initialEntries={[`/auth/verify-email${query}`]}>
      <VerifyEmailPage />
    </MemoryRouter>,
  );
}

beforeEach(() => { navigateMock.mockClear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('VerifyEmailPage', () => {
  it('missing token offers a working resend path without consuming anything', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderAt();
    expect(screen.getByTestId('verify-email-status-error-missing_token').textContent).toContain('缺少');
    expect(screen.getByRole('link', { name: '重新取得驗證信' }).getAttribute('href')).toBe('/signup/check-email');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('expired token offers a resend path instead of an unrelated login action', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'expired' }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    renderAt('?token=expired-token');
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('verify-email-confirm-btn'));
    await waitFor(() => expect(screen.getByTestId('verify-email-status-error-expired')).toBeTruthy());
    expect(screen.getByRole('link', { name: '重新取得驗證信' }).getAttribute('href')).toBe('/signup/check-email');
  });

  it('used token offers login; network failure retains a retry action', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'used' }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    renderAt('?token=retry-token');
    fireEvent.click(screen.getByTestId('verify-email-confirm-btn'));
    await waitFor(() => expect(screen.getByTestId('verify-email-status-error-network')).toBeTruthy());
    fireEvent.click(screen.getByTestId('verify-email-retry'));
    await waitFor(() => expect(screen.getByTestId('verify-email-status-error-used')).toBeTruthy());
    expect(screen.getByRole('link', { name: '前往登入' }).getAttribute('href')).toBe('/login');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('unreadable server response keeps a retry exit rather than claiming a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 500 })));
    renderAt('?token=server-token');
    fireEvent.click(screen.getByTestId('verify-email-confirm-btn'));
    await waitFor(() => expect(screen.getByTestId('verify-email-status-error-server_error')).toBeTruthy());
    expect(screen.getByTestId('verify-email-retry')).toBeTruthy();
  });

  it('a different token starts a fresh confirmation and ignores the old pending result', async () => {
    let resolveOld: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((resolve) => { resolveOld = resolve; })));
    render(
      <MemoryRouter initialEntries={['/auth/verify-email?token=old']}>
        <Link to="/auth/verify-email?token=new">另一封驗證信</Link>
        <VerifyEmailPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('verify-email-confirm-btn'));
    expect(screen.getByTestId('verify-email-status-verifying')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: '另一封驗證信' }));
    expect(screen.getByTestId('verify-email-confirm-btn')).toBeTruthy();
    resolveOld!(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('verify-email-confirm-btn')).toBeTruthy();
    expect(screen.queryByTestId('verify-email-status-success')).toBeNull();
  });

  it('success stays visible with an explicit login action and no later forced navigation', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    const page = renderAt('?token=valid-token');
    await act(async () => {
      fireEvent.click(screen.getByTestId('verify-email-confirm-btn'));
      await Promise.resolve();
    });
    expect(screen.getByTestId('verify-email-status-success').textContent).toContain('成功');
    expect(screen.getByRole('link', { name: '前往登入' }).getAttribute('href')).toBe('/login?verified=1');
    page.unmount();
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
