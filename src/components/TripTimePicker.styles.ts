/**
 * TripTimePicker scoped styles.
 *
 * Trigger reuses tp-input-short solo visual (22px bold center, 44px).
 * Popover: 2-column scrolling lists (hour + minute).
 */
export const TRIP_TIME_PICKER_STYLES = `
.tp-time-picker {
  position: relative;
  width: 100%;
}

.tp-time-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  min-height: var(--spacing-tap-min, 44px);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-background);
  color: var(--color-foreground);
  font: inherit;
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  color-scheme: light;
  -webkit-appearance: none;
  appearance: none;
}
.tp-time-trigger:hover:not(:disabled) {
  border-color: var(--color-accent);
}
.tp-time-trigger:focus-visible,
.tp-time-trigger[data-open] {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-time-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.tp-time-trigger.is-placeholder .tp-time-value {
  color: var(--color-muted);
  font-weight: 500;
}
.tp-time-value {
  flex: 1;
  text-align: center;
  pointer-events: none;
}
.tp-time-chev {
  width: 18px;
  height: 18px;
  color: var(--color-muted);
  flex-shrink: 0;
}

/* === Popover === */
.tp-time-popover {
  background: var(--color-background);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  padding: 12px;
  z-index: var(--z-popover, 1100);
  outline: none;
  animation: tp-time-pop 0.12s ease-out;
}
@keyframes tp-time-pop {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.tp-time-cols {
  display: flex;
  gap: 12px;
}
.tp-time-col {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 72px;
}
.tp-time-col-label {
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 6px;
}
.tp-time-col-scroll {
  display: flex;
  flex-direction: column;
  gap: 2px;
  height: 240px;
  overflow-y: auto;
  scrollbar-width: thin;
  scroll-snap-type: y proximity;
  padding: 4px 2px;
}
.tp-time-col-scroll::-webkit-scrollbar {
  width: 4px;
}
.tp-time-col-scroll::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

.tp-time-cell {
  flex-shrink: 0;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  font: inherit;
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-foreground);
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
  scroll-snap-align: center;
  text-align: center;
}
.tp-time-cell:hover {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
}
.tp-time-cell.is-selected {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  font-weight: 700;
}
.tp-time-cell:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
`;
