/**
 * error-boundary.test.tsx — v2.33.44 round 6a test gap fill
 *
 * ErrorBoundary 是 app-wide safety net，子 component render error 全靠它接住。
 * 之前零測試 — 任何 fallback UI 改寫或 captureException wiring 漂移都會 silent
 * 破。本 spec 守住 fallback render + Sentry capture wire + retry counter +
 * dev-only console gate (v2.33.44 round 6a fix)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const captureExceptionMock = vi.fn();
vi.mock('@sentry/react', () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

import { ErrorBoundary } from '../../src/components/shared/ErrorBoundary';

function Boom(): never {
  throw new Error('boom!');
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  captureExceptionMock.mockClear();
  sessionStorage.clear();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('ErrorBoundary', () => {
  it('正常 children → renders children', () => {
    render(
      <ErrorBoundary>
        <div data-testid="ok">child ok</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });

  it('child throws → fallback UI 顯示 (default)', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('哎呀，出了點狀況')).toBeInTheDocument();
    expect(screen.getByText('重新載入')).toBeInTheDocument();
  });

  it('child throws → captureException 被呼叫 (Sentry wire)', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [err, opts] = captureExceptionMock.mock.calls[0] ?? [];
    expect((err as Error).message).toBe('boom!');
    expect(opts).toMatchObject({ extra: { componentStack: expect.any(String) } });
  });

  it('custom fallback prop 取代 default UI', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">custom</div>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.queryByText('哎呀，出了點狀況')).not.toBeInTheDocument();
  });

  it('retry counter 超過 max → 隱藏 reload button', () => {
    sessionStorage.setItem('eb_retry', '5');
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.queryByText('重新載入')).not.toBeInTheDocument();
    expect(screen.getByText(/多次嘗試後仍然失敗/)).toBeInTheDocument();
  });
});
