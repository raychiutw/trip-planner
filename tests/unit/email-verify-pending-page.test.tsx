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

  it('Resend network failure → error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    renderAt('email=u@x.com');
    for (let i = 0; i < 60; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    }

    vi.useRealTimers();
    fireEvent.click(screen.getByTestId('verify-resend'));

    await waitFor(() => expect(screen.queryByTestId('verify-resend-error')).toBeTruthy());
  });
});
