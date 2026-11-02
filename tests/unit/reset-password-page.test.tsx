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
    expect(screen.getByTestId('reset-password-input').getAttribute('aria-describedby')).toBe(screen.getByTestId('reset-pw-error').id);
    expect(screen.getByTestId('reset-password-input').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByTestId('reset-password-input'));
  });

  it('mismatch points to confirmation and can be corrected', async () => {
    vi.useRealTimers();
    renderAt('token=t');
    fireEvent.change(screen.getByTestId('reset-password-input'), { target: { value: 'longpassword1' } });
    fireEvent.change(screen.getByTestId('reset-confirm'), { target: { value: 'different1234' } });
    fireEvent.click(screen.getByTestId('reset-submit'));
    expect(screen.getByTestId('reset-confirm').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByTestId('reset-confirm').getAttribute('aria-describedby')).toBe(screen.getByTestId('reset-pw-error').id);
    expect(document.activeElement).toBe(screen.getByTestId('reset-confirm'));
    fireEvent.change(screen.getByTestId('reset-confirm'), { target: { value: 'longpassword1' } });
    expect(screen.queryByTestId('reset-pw-error')).toBeNull();
  });

  it.each(['RESET_PASSWORD_TOO_SHORT', 'RESET_PASSWORD_FORMAT'])(
    '%s points to new password and allows correction', async (code) => {
      vi.useRealTimers();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code } }), { status: 400 })));
      renderAt('token=t');
      fireEvent.change(screen.getByTestId('reset-password-input'), { target: { value: 'goodpassword1' } });
      fireEvent.change(screen.getByTestId('reset-confirm'), { target: { value: 'goodpassword1' } });
      fireEvent.click(screen.getByTestId('reset-submit'));
      await waitFor(() => expect(screen.getByTestId('reset-password-input').getAttribute('aria-describedby')).toBe(screen.getByTestId('reset-pw-error').id));
      expect(screen.getByTestId('reset-password-input').getAttribute('aria-invalid')).toBe('true');
      fireEvent.change(screen.getByTestId('reset-password-input'), { target: { value: 'otherpassword1' } });
      expect(screen.queryByTestId('reset-pw-error')).toBeNull();
    },
  );

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
    expect(screen.getByTestId('reset-go-login').getAttribute('href')).toBe('/login');

    expect(fetchMock).toHaveBeenCalledWith('/api/oauth/reset-password', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as { token: string; password: string };
    expect(body.token).toBe('t');
    expect(body.password).toBe('goodpassword1');
  });

  it('deduplicates a pending reset submission', async () => {
    vi.useRealTimers();
    let resolve!: (value: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal('fetch', fetchMock);
    renderAt('token=t');
    fireEvent.change(screen.getByTestId('reset-password-input'), { target: { value: 'goodpassword1' } });
    fireEvent.change(screen.getByTestId('reset-confirm'), { target: { value: 'goodpassword1' } });
    fireEvent.submit(screen.getByTestId('reset-submit').closest('form')!);
    fireEvent.submit(screen.getByTestId('reset-submit').closest('form')!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await waitFor(() => expect(screen.getByTestId('reset-go-login')).toBeTruthy());
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

  it('RESET_RATE_LIMITED → recoverable warning on the form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'RESET_RATE_LIMITED', message: 'slow down' } }),
        { status: 429 },
      ),
    ));
    vi.useRealTimers();

    renderAt('token=t');
    fireEvent.change(screen.getByTestId('reset-password-input'), { target: { value: 'goodpassword1' } });
    fireEvent.change(screen.getByTestId('reset-confirm'), { target: { value: 'goodpassword1' } });
    fireEvent.click(screen.getByTestId('reset-submit'));

    await waitFor(() => expect(screen.queryByTestId('reset-banner-error')).toBeTruthy());
    expect(screen.getByTestId('reset-banner-error').textContent).toContain('過多');
    expect(screen.queryByTestId('reset-retry')).toBeNull();
  });

  it('Network failure → banner-error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    vi.useRealTimers();

    renderAt('token=t');
    fireEvent.change(screen.getByTestId('reset-password-input'), { target: { value: 'goodpassword1' } });
    fireEvent.change(screen.getByTestId('reset-confirm'), { target: { value: 'goodpassword1' } });
    fireEvent.click(screen.getByTestId('reset-submit'));

    await waitFor(() => expect(screen.queryByTestId('reset-banner-error')).toBeTruthy());
    expect(screen.queryByTestId('reset-retry')).toBeNull();
    expect(screen.getByTestId('reset-submit').hasAttribute('disabled')).toBe(false);
  });
});
