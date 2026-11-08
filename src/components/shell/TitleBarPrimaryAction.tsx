import Icon from '../shared/Icon';

/**
 * TitleBarPrimaryAction — primary confirm button for TitleBar action slot.
 *
 * Wraps the repeated 8-line `<button class="tp-titlebar-action is-primary">`
 * + Icon + label JSX from form pages (NewTripPage / EditTripPage / AddStopPage /
 * EntryActionPage / DeveloperAppNewPage). Single source for testid + busy state +
 * aria-label conventions.
 *
 * Visual: rounded-rect (radius-md), accent filled。
 * **桌機與手機都顯示文字 label**（#1559 owner 簽核：建立／完成／儲存這類關鍵動作 icon-only 辨識度太低）。
 * 一般 chrome action（探索、選單）仍是 ≤760px icon-only（W3 規則）；本元件靠
 * `.tp-titlebar-action--labeled` 在 `css/tokens.css` 把 label 還原。hover tooltip (title attr) 保留。
 * 送出中：換 busy label、前置 spinner、`aria-busy` 並 disabled。
 * See DESIGN.md "Page Titlebar > Action button"。（mockup 流程已於 2026-07-23 退役，S23 不再是 SoT。）
 */
export interface TitleBarPrimaryActionProps {
  /** Icon name from src/components/shared/Icon registry. Default: 'check'. */
  icon?: string;
  /** Visible label (desktop) + aria-label fallback. */
  label: string;
  /** Label shown when busy=true. Default: `${label}⋯`. */
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  testId?: string;
}

export default function TitleBarPrimaryAction({
  icon = 'check',
  label,
  busyLabel,
  busy = false,
  disabled = false,
  onClick,
  testId,
}: TitleBarPrimaryActionProps) {
  const displayLabel = busy ? (busyLabel ?? `${label}⋯`) : label;
  return (
    <button
      type="button"
      className="tp-titlebar-action tp-titlebar-action--labeled is-primary"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={displayLabel}
      title={displayLabel}
      data-testid={testId}
    >
      {busy ? <span className="tp-titlebar-action-spinner" aria-hidden="true" /> : <Icon name={icon} />}
      <span className="tp-titlebar-action-label">{displayLabel}</span>
    </button>
  );
}
