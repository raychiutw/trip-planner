/**
 * EmailVerifyPendingPage unit test — V2-P2
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmailVerifyPendingPage from '../../src/pages/EmailVerifyPendingPage';

function renderAt(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/signup/check-email?${query}`]}>
      <EmailVerifyPendingPage />
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

describe('EmailVerifyPendingPage', () => {
  it('renders email from query', () => {
    renderAt('email=test%40example.com');
    expect(screen.getByTestId('verify-email').textContent).toBe('test@example.com');
  });

  it('lowercases + trims email', () => {
    renderAt('email=%20Mixed%40EXAMPLE.com%20');
    expect(screen.getByTestId('verify-email').textContent).toBe('mixed@example.com');
  });

  it('renders fallback text when email query missing', () => {
    renderAt('');
    expect(screen.getByTestId('verify-email').textContent).toContain('沒有');
    expect(screen.getByRole('textbox', { name: '電子郵件' })).toBeTruthy();
  });

  it('direct recovery accepts an email and sends a verification request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderAt('');
    fireEvent.change(screen.getByRole('textbox', { name: '電子郵件' }), { target: { value: 'New@Example.com' } });
    expect(screen.getByRole('heading', { name: '重新取得驗證信' })).toBeTruthy();
    vi.useRealTimers();
    fireEvent.click(screen.getByTestId('verify-resend'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as { email: string };
    expect(body.email).toBe('new@example.com');
    expect(screen.getByTestId('verify-email').textContent).toBe('new@example.com');
    expect(screen.getByRole('heading', { name: '查看你的信箱' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: '電子郵件' }), { target: { value: 'other@example.com' } });
    expect(screen.getByRole('heading', { name: '重新取得驗證信' })).toBeTruthy();
  });

  it('direct recovery keeps an invalid address editable without sending', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderAt('');
    const input = screen.getByRole('textbox', { name: '電子郵件' });
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByTestId('verify-resend'));
    expect(screen.getByRole('alert').textContent).toContain('有效的電子郵件');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the requested destination stable while a resend is in flight', async () => {
    let resolveResend: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((resolve) => { resolveResend = resolve; })));
    renderAt('');
    const input = screen.getByRole('textbox', { name: '電子郵件' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'reader@example.com' } });
    fireEvent.click(screen.getByTestId('verify-resend'));
    expect(input.disabled).toBe(true);
    resolveResend!(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await act(async () => { await Promise.resolve(); });
    expect(input.disabled).toBe(false);
  });

  it('"打開信箱" link uses mailto:', () => {
    renderAt('email=u@x.com');
    const link = screen.getByTestId('verify-open-mail') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('mailto:');
  });

  it('Resend button disabled until 60s cooldown elapses', async () => {
    renderAt('email=u@x.com');
    const btn = screen.getByTestId('verify-resend') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('60 秒');

    // Advance 60s in 1s steps — chained setTimeout needs microtask flush per fire
    for (let i = 0; i < 60; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain('重新寄送');
  });

  it('background time jump restores the resend action from the deadline without a live countdown', () => {
    renderAt('email=u@x.com');
    const btn = screen.getByTestId('verify-resend') as HTMLButtonElement;
    expect(btn.getAttribute('aria-live')).toBe('off');
    act(() => {
      vi.setSystemTime(new Date('2026-04-25T00:02:00Z'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('重新寄送驗證信');
  });

  it('leaving the page clears its countdown timer and visibility listener', () => {
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const page = renderAt('email=u@x.com');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    page.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    removeListener.mockRestore();
  });

  it('Resend → POST send-verification + reset cooldown + show sent message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderAt('email=u@x.com');
    // Tick past cooldown
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });

    const btn = screen.getByTestId('verify-resend') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    vi.useRealTimers();
    fireEvent.click(btn);

    await waitFor(() => expect(screen.queryByTestId('verify-resend-sent')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/oauth/send-verification');
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as { email: string };
    expect(body.email).toBe('u@x.com');
  });

  it('repeated clicks during a slow resend make one request', async () => {
    let resolveResend: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { resolveResend = resolve; });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal('fetch', fetchMock);
    renderAt('email=u@x.com');
    act(() => { vi.advanceTimersByTime(60_000); });
    vi.useRealTimers();
    const btn = screen.getByTestId('verify-resend') as HTMLButtonElement;
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(btn.disabled).toBe(true);
    resolveResend!(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await waitFor(() => expect(screen.getByTestId('verify-resend-sent')).toBeTruthy());
  });

  it('Resend network failure → error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    renderAt('email=u@x.com');
    for (let i = 0; i < 60; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    }

    vi.useRealTimers();
    fireEvent.click(screen.getByTestId('verify-resend'));

    await waitFor(() => expect(screen.queryByTestId('verify-resend-error')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toContain('重寄失敗');
  });

  it('server rate limit uses Retry-After as the next resend deadline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: 'VERIFY_RATE_LIMITED' } }),
      { status: 429, headers: { 'Retry-After': '300' } },
    )));
    renderAt('email=u@x.com');
    act(() => { vi.advanceTimersByTime(60_000); });
    vi.useRealTimers();
    fireEvent.click(screen.getByTestId('verify-resend'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('寄送次數過多'));
    const btn = screen.getByTestId('verify-resend') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('300 秒');
  });
});
