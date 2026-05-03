import Icon from '../shared/Icon';

/**
 * TitleBarPrimaryAction — primary confirm button for TitleBar action slot.
 *
 * Wraps the repeated 8-line `<button class="tp-titlebar-action is-primary">`
 * + Icon + label JSX from form pages (NewTripPage / EditTripPage / AddStopPage /
 * EntryActionPage / DeveloperAppNewPage). Single source for testid + busy state +
 * aria-label conventions.
 *
 * Visual: rounded-rect (radius-md), accent filled, icon + responsive label
 * (label hidden on mobile via `.tp-titlebar-action-label` @media). See
 * DESIGN.md "Page Titlebar > Action button" + mockup S23.
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
      data-testid={testId}
    >
      <Icon name={icon} />
      <span className="tp-titlebar-action-label">{displayLabel}</span>
    </button>
  );
}
