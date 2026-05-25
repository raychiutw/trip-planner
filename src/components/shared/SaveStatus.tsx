/**
 * SaveStatus — autosave 視覺指示元件
 *
 * 取代 explicit「儲存」button 作為 user reassurance：使用者編輯後欄位自動 save，
 * 此 component 顯示當前 state（pending / saving / saved / error / offline）。
 *
 * 配合 `useAutosave` hook 用：
 *   const { state, error, retry } = useAutosave({...});
 *   <SaveStatus state={state} error={error} onRetry={retry} />
 */
import { memo, type ReactElement } from 'react';
import type { SaveState } from '../../hooks/useAutosave';

interface SaveStatusProps {
  state: SaveState;
  error?: string | null;
  /** Retry handler — 顯示 error 時的 button onClick。 */
  onRetry?: () => void | Promise<void>;
  /** Compact 模式（pill 樣式 sticky bar，無 retry button）— 預設 false（inline 樣式）。 */
  compact?: boolean;
}

const STATE_LABEL: Record<SaveState, string> = {
  idle: '',
  pending: '即將儲存…',
  saving: '儲存中…',
  saved: '已儲存',
  error: '儲存失敗',
  offline: '離線 — 待連線後儲存',
};

const STATE_ICON: Record<SaveState, string> = {
  idle: '',
  pending: '✎',
  saving: '⟳',
  saved: '✓',
  error: '⚠',
  offline: '⊘',
};

/** Inline / compact pill 共用 styles inject 一次。SCOPED_STYLES 模式對齊既有 component 慣例。 */
const SCOPED_STYLES = `
.tp-save-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-caption);
  font-weight: 600;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  transition: opacity var(--transition-duration-fast) ease,
              color var(--transition-duration-fast) ease;
}
.tp-save-status--idle { opacity: 0; }
.tp-save-status--pending { color: var(--color-muted); }
.tp-save-status--saving { color: var(--color-info); }
.tp-save-status--saved { color: var(--color-success); }
.tp-save-status--error { color: var(--color-destructive); }
.tp-save-status--offline { color: var(--color-warning); }
.tp-save-status-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px;
}
.tp-save-status--saving .tp-save-status-icon {
  animation: tp-save-status-spin 0.8s linear infinite;
}
@keyframes tp-save-status-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.tp-save-status-retry {
  margin-left: 8px;
  padding: 2px 8px;
  border: 1px solid var(--color-destructive);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-destructive);
  font: inherit;
  font-size: var(--font-size-caption2);
  font-weight: 600;
  cursor: pointer;
  min-height: var(--spacing-tap-min);
}
.tp-save-status-retry:hover { background: var(--color-destructive-bg); }

/* Compact pill variant — sticky bottom-right 樣式 */
.tp-save-status--pill {
  padding: 6px 12px;
  border-radius: var(--radius-full);
  background: var(--color-background);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border);
}
`;

function SaveStatusBase({ state, error, onRetry, compact = false }: SaveStatusProps): ReactElement | null {
  if (state === 'idle') return null;
  const label = STATE_LABEL[state];
  const icon = STATE_ICON[state];
  const className = `tp-save-status tp-save-status--${state}${compact ? ' tp-save-status--pill' : ''}`;
  return (
    <span className={className} role="status" aria-live="polite" data-testid="save-status">
      <style>{SCOPED_STYLES}</style>
      {icon && <span className="tp-save-status-icon" aria-hidden="true">{icon}</span>}
      <span className="tp-save-status-label">{label}</span>
      {state === 'error' && error && (
        <span className="tp-save-status-error-detail" data-testid="save-status-error">（{error}）</span>
      )}
      {state === 'error' && onRetry && (
        <button
          type="button"
          className="tp-save-status-retry"
          onClick={() => { void onRetry(); }}
          data-testid="save-status-retry"
        >
          重試
        </button>
      )}
    </span>
  );
}

const SaveStatus = memo(SaveStatusBase);
export default SaveStatus;
