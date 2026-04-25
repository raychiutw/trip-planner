/**
 * ForgotPasswordPage unit test — V2-P3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from '../../src/pages/ForgotPasswordPage';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('ForgotPasswordPage', () => {
  it('renders email input + submit', () => {
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    expect(screen.getByTestId('forgot-email')).toBeTruthy();
    expect(screen.getByTestId('forgot-submit')).toBeTruthy();
  });

  it('200 response → success state with generic message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, message: '若 email 已註冊...' }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    fireEvent.change(screen.getByTestId('forgot-email'), { target: { value: 'u@x.com' } });
    fireEvent.click(screen.getByTestId('forgot-submit'));

    await waitFor(() => expect(screen.queryByTestId('forgot-email')).toBeNull());
    expect(screen.getByText(/查看你的信箱/)).toBeTruthy();
    expect(screen.getByText(/u@x\.com/)).toBeTruthy();
  });

  it('429 → warning banner with retry-after', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'FORGOT_PASSWORD_RATE_LIMITED', message: 'too many' } }),
        { status: 429, headers: { 'Retry-After': '120' } },
      ),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    fireEvent.change(screen.getByTestId('forgot-email'), { target: { value: 'u@x.com' } });
    fireEvent.click(screen.getByTestId('forgot-submit'));

    await waitFor(() => expect(screen.queryByTestId('forgot-banner-warning')).toBeTruthy());
    expect(screen.getByTestId('forgot-banner-warning').textContent).toContain('120');
  });

  it('Network error → warning banner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    vi.useRealTimers();

    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    fireEvent.change(screen.getByTestId('forgot-email'), { target: { value: 'u@x.com' } });
    fireEvent.click(screen.getByTestId('forgot-submit'));

    await waitFor(() => expect(screen.queryByTestId('forgot-banner-warning')).toBeTruthy());
    expect(screen.getByTestId('forgot-banner-warning').textContent).toContain('網路');
  });

  it('trims email before POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    fireEvent.change(screen.getByTestId('forgot-email'), { target: { value: '  u@x.com  ' } });
    fireEvent.click(screen.getByTestId('forgot-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as { email: string };
    expect(body.email).toBe('u@x.com');
  });
});
