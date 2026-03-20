import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

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
        <div className="p-8 text-center">
          <h2>發生錯誤</h2>
          <p>{canRetry ? '請嘗試重新載入頁面' : '重複載入失敗，請稍後再試或聯繫管理員'}</p>
          {canRetry && (
            <button onClick={this.handleReload}>重新載入</button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
