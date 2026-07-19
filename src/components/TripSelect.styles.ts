/**
 * TripSelect scoped styles (Variant B Spacious mockup).
 *
 * Trigger reuses .tp-input-short solo (short-text variant, 16px / 600).
 * Popover uses headlessui anchor positioning + terracotta tokens.
 */
export const TRIP_SELECT_STYLES = `
.tp-select {
  position: relative;
  width: 100%;
}
.tp-select--pill {
  position: relative;
  width: auto;
  display: inline-flex;
}

.tp-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  min-height: var(--spacing-tap-min, 44px);
  border: 1.5px solid var(--color-border-control);
  border-radius: var(--radius-md);
  background-color: var(--color-background);
  color: var(--color-foreground);
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--transition-duration-fast), box-shadow var(--transition-duration-fast);
  color-scheme: light;
  -webkit-appearance: none;
  appearance: none;
}
.tp-select-trigger:hover:not(:disabled) {
  border-color: var(--color-accent);
}
.tp-select-trigger:focus-visible,
.tp-select-trigger[data-open] {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-select-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.tp-select--pill .tp-select-trigger {
  padding: 6px 12px;
  min-height: var(--spacing-tap-min);
  border-radius: var(--radius-full);
  border-width: 1px;
  font-size: var(--font-size-footnote);
  font-weight: 600;
  width: auto;
}
.tp-select-trigger.is-placeholder .tp-select-value {
  color: var(--color-muted);
  font-weight: 500;
}
.tp-select-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tp-select-chev {
  width: 18px;
  height: 18px;
  color: var(--color-muted);
  flex-shrink: 0;
  transition: transform var(--transition-duration-fast);
}
.tp-select-trigger[data-open] .tp-select-chev {
  transform: rotate(180deg);
  color: var(--color-accent);
}

/* === ListboxOptions popover === */
.tp-select-list {
  background: var(--color-background);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  padding: 8px;
  min-width: var(--button-width, 200px);
  max-height: 320px;
  overflow-y: auto;
  z-index: var(--z-popover, 1100);
  outline: none;
  animation: tp-select-pop var(--transition-duration-fast) ease-out;
}
@keyframes tp-select-pop {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.tp-select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-size: 16px;
  color: var(--color-foreground);
  cursor: pointer;
  transition: background-color var(--transition-duration-fast), color var(--transition-duration-fast);
  user-select: none;
}
.tp-select-item + .tp-select-item {
  margin-top: 2px;
}
.tp-select-item[data-focus],
.tp-select-item:hover:not([data-disabled]) {
  background: var(--color-accent-subtle);
}
.tp-select-item[data-selected] {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  font-weight: 700;
}
.tp-select-item[data-disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}
.tp-select-item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tp-select-check {
  width: 18px;
  height: 18px;
  color: var(--color-accent);
  flex-shrink: 0;
}
`;
