import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const RETRY_KEY = 'eb_retry';
const MAX_RETRIES = 2;

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleReload = () => {
    const retries = Number(sessionStorage.getItem(RETRY_KEY) || '0');
    if (retries >= MAX_RETRIES) {
      sessionStorage.removeItem(RETRY_KEY);
      return; // Stop retrying
    }
    sessionStorage.setItem(RETRY_KEY, String(retries + 1));
    window.location.reload();
  };

  componentDidMount() {
    // Clear retry counter on successful render
    sessionStorage.removeItem(RETRY_KEY);
  }

  render() {
    if (this.state.hasError) {
      const retries = Number(sessionStorage.getItem(RETRY_KEY) || '0');
      const canRetry = retries < MAX_RETRIES;

      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center min-h-dvh bg-background px-6">
          {/* Decorative wave */}
          <svg width="80" height="40" viewBox="0 0 80 40" fill="none" className="mb-6 opacity-30">
            <path d="M0 20 Q20 5 40 20 T80 20" stroke="var(--color-accent)" strokeWidth="3" fill="none" />
            <path d="M0 28 Q20 13 40 28 T80 28" stroke="var(--color-accent)" strokeWidth="2" fill="none" opacity="0.5" />
          </svg>
          <h2 className="text-title2 font-semibold text-foreground mb-2">哎呀，出了點狀況</h2>
          <p className="text-callout text-muted mb-6 max-w-xs text-center leading-relaxed">
            {canRetry
              ? '頁面遇到了意外的問題，重新載入通常可以解決'
              : '多次嘗試後仍然失敗，請稍後再試或聯繫管理員'}
          </p>
          {canRetry && (
            <button
              onClick={this.handleReload}
              className="min-h-tap-min px-6 py-3 rounded-md bg-accent text-white text-callout font-medium shadow-sm transition-colors duration-fast active:opacity-80"
            >
              重新載入
            </button>
          )}
          <p className="text-caption text-muted mt-8 opacity-60">Tripline</p>
        </div>
      );
    }
    return this.props.children;
  }
}
