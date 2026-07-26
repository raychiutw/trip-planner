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
 * **桌機 icon + 可見文字 label，手機（≤760px）才 icon-only** —— W3（owner 2026-07-24）推翻了
 * v2.31.90 的「全 viewport icon-only」，理由是 HIG header 慣例要求動作鈕帶文字。
 * 規則在 `css/tokens.css` 的 `.tp-titlebar-action-label`；hover tooltip (title attr) 兩邊都保留。
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
      className="tp-titlebar-action is-primary"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={displayLabel}
      title={displayLabel}
      data-testid={testId}
    >
      <Icon name={icon} />
      <span className="tp-titlebar-action-label">{displayLabel}</span>
    </button>
  );
}
