/**
 * PoiStatusBadge — POI lifecycle status badge.
 *
 * 三種 POI status (migration 0051)：
 *   - 'active'  → return null（無 badge）
 *   - 'closed'  → 紅 destructive badge「已歇業」
 *   - 'missing' → 黃 warning badge「查無資料」
 *
 * 對齊 mockup .tp-badge primitive（terracotta-preview-v2.html L565-588）：
 *   `.tp-badge.is-destructive` / `.tp-badge.is-warning` 含 dot + 文字 label。
 *   **禁 emoji icon**（tests/unit/no-emoji-icons.test.ts hard CI gate）。
 *   **禁 strikethrough**（degrades CJK 可讀性 — autoplan T3 fix）。
 *
 * Closed entry container 應套 `opacity: 0.65`（沿用 data-past pattern）— 但
 * 不在 badge 自身，由 caller 包裹 entry 套 className。
 *
 * a11y：role="status" + aria-label="{status} {reason}"，screen reader 不依賴 color。
 */
import type { ReactNode } from 'react';

export type PoiStatus = 'active' | 'closed' | 'missing';

export interface PoiStatusBadgeProps {
  status: PoiStatus | null | undefined;
  /** Human-readable reason from `pois.status_reason`. Optional — caller may omit. */
  reason?: string | null;
  /** Test id for unit test selector. Default: 'poi-status-badge'. */
  testId?: string;
}

const STATUS_LABEL: Record<Exclude<PoiStatus, 'active'>, string> = {
  closed: '已歇業',
  missing: '查無資料',
};

const STATUS_VARIANT: Record<Exclude<PoiStatus, 'active'>, 'destructive' | 'warning'> = {
  closed: 'destructive',
  missing: 'warning',
};

const PoiStatusBadgeStyles = `
.tp-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px; font-weight: 600;
  vertical-align: middle;
  white-space: nowrap;
}
.tp-badge-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.tp-badge.is-warning {
  background: var(--color-warning-bg, rgba(244, 140, 6, 0.12));
  color: var(--color-warning, #C88500);
}
.tp-badge.is-warning .tp-badge-dot { background: var(--color-warning, #C88500); }
.tp-badge.is-destructive {
  background: var(--color-destructive-bg, #FDECEC);
  color: var(--color-destructive, #C13515);
}
.tp-badge.is-destructive .tp-badge-dot { background: var(--color-destructive, #C13515); }
`;

export default function PoiStatusBadge({
  status,
  reason,
  testId = 'poi-status-badge',
}: PoiStatusBadgeProps): ReactNode {
  if (!status || status === 'active') return null;

  const label = STATUS_LABEL[status];
  const variant = STATUS_VARIANT[status];
  const ariaLabel = reason ? `${label}：${reason}` : label;

  return (
    <>
      <style>{PoiStatusBadgeStyles}</style>
      <span
        className={`tp-badge is-${variant}`}
        role="status"
        aria-label={ariaLabel}
        data-testid={testId}
        data-status={status}
      >
        <span className="tp-badge-dot" aria-hidden="true" />
        {label}
      </span>
    </>
  );
}
