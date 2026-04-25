/**
 * ResetPasswordPage unit test — V2-P3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordPage from '../../src/pages/ResetPasswordPage';

function renderAt(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/auth/password/reset?${query}`]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('ResetPasswordPage', () => {
  it('renders error when token missing from query', () => {
    renderAt('');
    expect(screen.getByText(/連結無法使用/)).toBeTruthy();
    expect(screen.getByTestId('reset-retry')).toBeTruthy();
  });

  it('renders form when token present', () => {
    renderAt('token=abc');
    expect(screen.getByTestId('reset-password-input')).toBeTruthy();
    expect(screen.getByTestId('reset-confirm')).toBeTruthy();
  });

  it('shows password strength indicators (length + letter+number)', () => {
    renderAt('token=t');
    const pwInput = screen.getByTestId('reset-password-input');
    fireEvent.change(pwInput, { target: { value: 'short' } });
    expect(screen.getByTestId('reset-check-length').className).not.toContain('tp-pw-check-ok');
    fireEvent.change(pwInput, { target: { value: 'longenough123' } });
    expect(screen.getByTestId('reset-check-length').className).toContain('tp-pw-check-ok');
    expect(screen.getByTestId('reset-check-mix').className).toContain('tp-pw-check-ok');
  });

  it('Submit with mismatched passwords → inline error', async () => {
    vi.useRealTimers();
    renderAt('token=t');
    fireEvent.change(screen.getByTestId('reset-password-input'), { target: { value: 'longpassword1' } });
    fireEvent.change(screen.getByTestId('reset-confirm'), { target: { value: 'different1234' } });
    fireEvent.click(screen.getByTestId('reset-submit'));
    await waitFor(() => expect(screen.queryByTestId('reset-pw-error')).toBeTruthy());
    expect(screen.getByTestId('reset-pw-error').textContent).toContain('不一致');
  });

  it('Submit with too short password → inline error (前端 guard)', async () => {
    vi.useRealTimers();
    renderAt('token=t');
    fireEvent.change(screen.getByTestId('reset-password-input'), { target: { value: 'short1' } });
    fireEvent.change(screen.getByTestId('reset-confirm'), { target: { value: 'short1' } });
    fireEvent.click(screen.getByTestId('reset-submit'));
    await waitFor(() => expect(screen.queryByTestId('reset-pw-error')).toBeTruthy());
    expect(screen.getByTestId('reset-pw-error').textContent).toContain('8 字');
  });

  it('Successful reset → success state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    renderAt('token=t');
    fireEvent.change(screen.getByTestId('reset-password-input'), { target: { value: 'goodpassword1' } });
    fireEvent.change(screen.getByTestId('reset-confirm'), { target: { value: 'goodpassword1' } });
    fireEvent.click(screen.getByTestId('reset-submit'));

    await waitFor(() => expect(screen.queryByTestId('reset-go-login')).toBeTruthy());
    expect(screen.getByText(/密碼已更新/)).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledWith('/api/oauth/reset-password', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as { token: string; password: string };
    expect(body.token).toBe('t');
    expect(body.password).toBe('goodpassword1');
  });

  it('RESET_TOKEN_INVALID → switches to error state with retry link', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'RESET_TOKEN_INVALID', message: '無效' } }),
        { status: 400 },
      ),
    ));
    vi.useRealTimers();

    renderAt('token=expired');
    fireEvent.change(screen.getByTestId('reset-password-input'), { target: { value: 'goodpassword1' } });
    fireEvent.change(screen.getByTestId('reset-confirm'), { target: { value: 'goodpassword1' } });
    fireEvent.click(screen.getByTestId('reset-submit'));

    await waitFor(() => expect(screen.queryByTestId('reset-retry')).toBeTruthy());
  });

  it('RESET_INVALID_PASSWORD → inline pw-error (邊界 case)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'RESET_INVALID_PASSWORD', message: 'bad' } }),
        { status: 400 },
      ),
    ));
    vi.useRealTimers();

    renderAt('token=t');
    fireEvent.change(screen.getByTestId('reset-password-input'), { target: { value: 'goodpassword1' } });
    fireEvent.change(screen.getByTestId('reset-confirm'), { target: { value: 'goodpassword1' } });
    fireEvent.click(screen.getByTestId('reset-submit'));

    await waitFor(() => expect(screen.queryByTestId('reset-pw-error')).toBeTruthy());
  });

  it('Network failure → banner-error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    vi.useRealTimers();

    renderAt('token=t');
    fireEvent.change(screen.getByTestId('reset-password-input'), { target: { value: 'goodpassword1' } });
    fireEvent.change(screen.getByTestId('reset-confirm'), { target: { value: 'goodpassword1' } });
    fireEvent.click(screen.getByTestId('reset-submit'));

    await waitFor(() => expect(screen.queryByTestId('reset-banner-error')).toBeTruthy());
  });
});
