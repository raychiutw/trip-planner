/**
 * AlertPanel — Section 4.10 (terracotta-ui-parity-polish) persistent banner
 *
 * 對應 mockup section 04 (line 5626-5678)。跟既有 component 區別：
 *   - <Toast>     短暫、auto-dismiss、訊息式
 *   - <InlineError> form field-level、永遠 destructive、單行
 *   - <ErrorPlaceholder> empty state-level、置中
 *   - <AlertPanel>  page-top persistent banner，3 variant (error / warning / info)
 *                  含 actionLabel + onAction + onDismiss
 *
 * Use case：page 載入失敗、offline 狀態、recovering 狀態 都靠此 component。
 */
import type { ReactNode } from 'react';
import Icon from './Icon';

export type AlertPanelVariant = 'error' | 'warning' | 'info';

export interface AlertPanelProps {
  variant: AlertPanelVariant;
  title: string;
  message?: ReactNode;
  /** Optional 主 action button label (e.g., 「重試」「關閉」)。不給就不 render action */
  actionLabel?: string;
  onAction?: () => void;
  /** 提供 onDismiss → 顯示右上角關閉 X button */
  onDismiss?: () => void;
  /** Override default icon name (預設 variant default：error=warning / warning=warning / info=info) */
  icon?: string;
}

const SCOPED_STYLES = `
.tp-alert-panel {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  margin: 12px 0;
}
.tp-alert-panel-icon {
  flex-shrink: 0;
  /* H13 exception: non-interactive decorative icon container（panel 本身不是
     interactive element；icon 只表 status，no click handler）。32×32 對齊
     panel typography metrics，不適用 44px tap-target 規則。 */
  width: 32px; height: 32px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--color-secondary);
  color: var(--color-foreground);
}
.tp-alert-panel-icon .svg-icon { width: 18px; height: 18px; }
.tp-alert-panel-body {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 4px;
}
.tp-alert-panel-title {
  font-size: var(--font-size-callout); font-weight: 700;
  color: var(--color-foreground);
  line-height: 1.4;
}
.tp-alert-panel-message {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  line-height: 1.4;
}
.tp-alert-panel-actions {
  display: flex; gap: 8px; align-items: center;
  flex-shrink: 0;
}
.tp-alert-panel-action {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 700;
  padding: 8px 14px; border-radius: var(--radius-full);
  border: 1px solid currentColor;
  background: transparent;
  cursor: pointer;
  min-height: var(--spacing-tap-min);
  color: inherit;
}
.tp-alert-panel-action:hover { filter: brightness(0.95); }
.tp-alert-panel-dismiss {
  font: inherit;
  width: 32px; height: 32px;
  border: none; background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  display: grid; place-items: center;
  border-radius: var(--radius-md);
}
.tp-alert-panel-dismiss:hover { background: var(--color-hover); color: var(--color-foreground); }
.tp-alert-panel-dismiss .svg-icon { width: 16px; height: 16px; }

/* Error variant — 紅 destructive border + icon */
.tp-alert-panel.is-error {
  background: var(--color-priority-high-bg);
  border-color: var(--color-priority-high-dot);
  color: var(--color-priority-high-dot);
}
.tp-alert-panel.is-error .tp-alert-panel-icon {
  background: var(--color-priority-high-dot);
  color: var(--color-accent-foreground);
}
.tp-alert-panel.is-error .tp-alert-panel-title { color: var(--color-priority-high-dot); }

/* Warning variant — amber border */
.tp-alert-panel.is-warning {
  background: var(--color-warning-bg);
  border-color: var(--color-warning);
  color: var(--color-warning-deep);
}
.tp-alert-panel.is-warning .tp-alert-panel-icon {
  background: var(--color-warning);
  color: var(--color-accent-foreground);
}
.tp-alert-panel.is-warning .tp-alert-panel-title { color: var(--color-warning-deep); }

/* Info variant — accent (default) */
.tp-alert-panel.is-info {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent-bg);
  color: var(--color-accent-deep);
}
.tp-alert-panel.is-info .tp-alert-panel-icon {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}
.tp-alert-panel.is-info .tp-alert-panel-title { color: var(--color-accent-deep); }
`;

const DEFAULT_ICONS: Record<AlertPanelVariant, string> = {
  error: 'warning',
  warning: 'warning',
  info: 'info',
};

export default function AlertPanel({
  variant,
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
  icon,
}: AlertPanelProps) {
  const iconName = icon ?? DEFAULT_ICONS[variant];
  return (
    <div className={`tp-alert-panel is-${variant}`} role={variant === 'error' ? 'alert' : 'status'} data-testid="alert-panel">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-alert-panel-icon" aria-hidden="true">
        <Icon name={iconName} />
      </div>
      <div className="tp-alert-panel-body">
        <div className="tp-alert-panel-title">{title}</div>
        {message && <div className="tp-alert-panel-message">{message}</div>}
      </div>
      <div className="tp-alert-panel-actions">
        {actionLabel && onAction && (
          <button
            type="button"
            className="tp-alert-panel-action"
            onClick={onAction}
            data-testid="alert-panel-action"
          >
            {actionLabel}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            className="tp-alert-panel-dismiss"
            onClick={onDismiss}
            aria-label="關閉提示"
            data-testid="alert-panel-dismiss"
          >
            <Icon name="x-mark" />
          </button>
        )}
      </div>
    </div>
  );
}
