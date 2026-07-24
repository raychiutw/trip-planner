/**
 * TripDatePicker scoped styles (Variant B Spacious mockup).
 *
 * Trigger reuses .tp-input-short solo (v2.33.16 base). Popover overrides
 * react-day-picker .rdp-* classes to terracotta tokens.
 */
export const TRIP_DATE_PICKER_STYLES = `
.tp-date-picker {
  position: relative;
  width: 100%;
}

.tp-date-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 14px;
  min-height: var(--spacing-tap-min, 44px);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-background);
  color: var(--color-foreground);
  font: inherit;
  font-size: 1.375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
  cursor: pointer;
  transition: border-color var(--transition-duration-fast), box-shadow var(--transition-duration-fast);
  color-scheme: light;
  -webkit-appearance: none;
  appearance: none;
}
.tp-date-trigger:hover:not(:disabled) {
  border-color: var(--color-accent);
}
.tp-date-trigger:focus-visible,
.tp-date-trigger.is-open {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-date-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.tp-date-value {
  flex: 1;
  text-align: center;
  pointer-events: none;
}
/* v2.33.120: placeholder 字體 16px → 22px 對齊 value，避免「出發」(有值) 與「回程」(placeholder) trigger 高度落差 */
.tp-date-value.is-placeholder {
  color: var(--color-muted);
  font-weight: 500;
  font-size: 1.375rem;
}
.tp-date-chev {
  width: 18px;
  height: 18px;
  color: var(--color-muted);
  flex-shrink: 0;
}

.tp-date-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: var(--z-popover, 1100);
  background: var(--color-background);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  padding: 20px;
  animation: tp-date-pop var(--transition-duration-fast) ease-out;
}
@keyframes tp-date-pop {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* === react-day-picker overrides (.rdp-*) === */
.tp-date-popover .rdp-root {
  --rdp-accent-color: var(--color-accent);
  --rdp-accent-background-color: var(--color-accent-subtle);
  --rdp-background-color: var(--color-background);
  --rdp-today-color: var(--color-accent-deep);
  --rdp-disabled-opacity: 0.35;
  --rdp-outside-opacity: 0.4;
  --rdp-day-height: 44px;
  --rdp-day-width: 44px;
  --rdp-day_button-height: 44px;
  --rdp-day_button-width: 44px;
  --rdp-day_button-border-radius: var(--radius-md);
  --rdp-weekday-text-transform: none;
  --rdp-weekday-padding: 0 0 8px 0;
  font-family: inherit;
  color: var(--color-foreground);
  margin: 0;
}

.tp-date-popover .rdp-month_caption {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-foreground);
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
  justify-content: center;
}

.tp-date-popover .rdp-nav {
  position: absolute;
  top: 12px;
  right: 0;
  gap: 6px;
  z-index: 1;
}
.tp-date-popover .rdp-nav button {
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  border-radius: var(--radius-sm);
  color: var(--color-foreground);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.tp-date-popover .rdp-nav button:hover {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  color: var(--color-accent-deep);
}
.tp-date-popover .rdp-nav button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tp-date-popover .rdp-nav button svg {
  width: 16px;
  height: 16px;
}

.tp-date-popover .rdp-weekday {
  font-size: var(--font-size-footnote);
  font-weight: 600;
  color: var(--color-muted);
}

.tp-date-popover .rdp-day {
  font-size: 0.9375rem;
  font-variant-numeric: tabular-nums;
}
.tp-date-popover .rdp-day_button {
  border: none;
  background: transparent;
  color: var(--color-foreground);
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: background-color var(--transition-duration-fast), color var(--transition-duration-fast);
}
.tp-date-popover .rdp-day_button:hover:not(:disabled) {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
}
.tp-date-popover .rdp-outside .rdp-day_button {
  color: var(--color-muted);
  opacity: 0.4;
}
.tp-date-popover .rdp-today:not(.rdp-selected) .rdp-day_button {
  border: 1.5px solid var(--color-accent);
  color: var(--color-accent-deep);
  font-weight: 700;
}
.tp-date-popover .rdp-selected .rdp-day_button {
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  font-weight: 700;
  box-shadow: var(--shadow-sm);
}
.tp-date-popover .rdp-disabled .rdp-day_button {
  opacity: 0.35;
  cursor: not-allowed;
}
.tp-date-popover .rdp-day_button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Mobile responsive — full-width popover on narrow viewports */
@media (max-width: 480px) {
  .tp-date-popover {
    position: fixed;
    inset: auto 16px 16px;
  }
  .tp-date-popover .rdp-root {
    --rdp-day-height: 40px;
    --rdp-day-width: 40px;
    --rdp-day_button-height: 40px;
    --rdp-day_button-width: 40px;
  }
}
`;
