/**
 * _tripFormStyles — shared CSS for NewTripModal + EditTripModal.
 *
 * 兩個 modal 的 backdrop / form-pane / close-button / form-row /
 * destinations sortable list / segmented control / sticky actions row 在
 * Terracotta v2 spec 下是同一份視覺，原本 SCOPED_STYLES 各自複製一次。
 * 此 module 用 comma-selector 同時 target `.tp-new-*` 和 `.tp-edit-*`
 * 兩個 prefix，避免改動既有 JSX class 字串（降低視覺回歸風險）。
 *
 * 各 modal 的 SCOPED_STYLES 仍存在，但只放各自特有的 rules：
 *   - NewTripModal：`.tp-new-flex-*`（date stepper）、`.tp-new-quota-*`
 *     （day quota）、`.tp-new-dest-chip-*`（熱門 / 最近）、`.tp-new-dest-helper`
 *     `.tp-new-dest-wrap` `.tp-new-dest-region` `.tp-new-form-grid`
 *     `.tp-new-modal-error` `.tp-new-modal-summary` `.tp-new-form-row-spaced`
 *   - EditTripModal：`.tp-edit-date-readonly/-line/-helper`、
 *     `.tp-edit-title-hint*`、`.tp-edit-dest-add-*` `.tp-edit-dest-badge`
 *     `.tp-edit-dest-quota` `.tp-edit-dest-search-wrap` `.tp-edit-loading`
 *     `.tp-edit-actions-publish*`
 */

export const TRIP_FORM_STYLES = `
/* ===== Modal backdrop + container ===== */
.tp-new-modal-backdrop,
.tp-edit-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(42, 31, 24, 0.55);
  z-index: var(--z-modal, 60);
  display: grid; place-items: center;
  padding: 16px;
  animation: tp-form-modal-fade 160ms var(--transition-timing-function-apple, ease-out);
}
@keyframes tp-form-modal-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes tp-new-modal-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes tp-edit-modal-fade { from { opacity: 0; } to { opacity: 1; } }

.tp-new-modal,
.tp-edit-modal {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 720px;
  font: inherit;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* QA 2026-04-26 PR-M：限制 modal 高度 + 讓 form pane 內捲，避免 mobile 內容
   * 被 viewport / iOS home indicator / chrome bottom-nav 切到。32px = 上下
   * backdrop padding 各 16。dvh 走 dynamic viewport 對應 Safari URL bar。 */
  max-height: calc(100dvh - 32px);
  position: relative;
}

/* ===== Form pane (scrollable inner) ===== */
.tp-new-form,
.tp-edit-form {
  padding: 24px;
  display: flex; flex-direction: column;
  /* QA 2026-04-26 PR-M：form pane 自己捲，避免整個 modal 撐爆 viewport。
   * min-height: 0 讓 grid child 可被 max-height 約束（grid 預設 min-height auto）。
   * padding-bottom 加 safe-area，避免 iOS home indicator 蓋到送出按鈕。
   * PR-V 2026-04-26：overscroll-behavior contain 防 iOS rubber-band 把 scroll
   * 傳到背景 page。 */
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
  padding-bottom: 0;
}
@media (min-width: 768px) {
  .tp-new-form,
  .tp-edit-form { padding: 28px 32px; padding-bottom: 0; }
}

/* ===== Close button (absolute, glass) ===== */
.tp-new-form-close,
.tp-edit-close {
  position: absolute;
  top: 12px; right: 12px;
  z-index: 2;
  width: var(--spacing-tap-min, 44px); height: var(--spacing-tap-min, 44px);
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(8px);
  display: grid; place-items: center;
  cursor: pointer;
  font-size: 18px; color: var(--color-foreground);
  box-shadow: var(--shadow-sm);
}
.tp-new-form-close:hover,
.tp-edit-close:hover {
  background: var(--color-background);
  color: var(--color-accent-deep);
}
.tp-new-form-close:focus-visible,
.tp-edit-close:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: 2px;
}

/* ===== Heading + sub ===== */
.tp-new-modal h2,
.tp-edit-modal h2 {
  /* mockup-parity-qa-fixes: mockup spec 700（曾為 800） */
  font-size: var(--font-size-title, 1.75rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 6px;
}
.tp-new-modal-sub,
.tp-edit-sub {
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  margin: 0 0 20px;
  line-height: 1.5;
}

/* ===== Form rows + label + input/textarea/select ===== */
.tp-new-form-row,
.tp-edit-row {
  display: flex; flex-direction: column;
  gap: 8px; margin-bottom: 16px;
}
.tp-new-form-row label,
.tp-edit-row label {
  font-size: var(--font-size-footnote);
  font-weight: 700; color: var(--color-foreground);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.tp-new-form-row input,
.tp-new-form-row textarea,
.tp-edit-row input[type="text"],
.tp-edit-row textarea,
.tp-edit-row select {
  padding: 12px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-secondary);
  color: var(--color-foreground);
  font: inherit;
  font-size: var(--font-size-body);
  min-height: var(--spacing-tap-min);
}
.tp-new-form-row textarea,
.tp-edit-row textarea {
  resize: vertical;
  min-height: 72px;
  line-height: 1.5;
}
.tp-new-form-row input:focus,
.tp-new-form-row textarea:focus,
.tp-edit-row input[type="text"]:focus,
.tp-edit-row textarea:focus,
.tp-edit-row select:focus {
  outline: none;
  border-color: var(--color-accent);
  background: var(--color-background);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}

/* ===== Sortable destinations list ===== */
.tp-new-dest-rows,
.tp-edit-dest-rows {
  display: flex; flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}
.tp-new-dest-row,
.tp-edit-dest-row {
  display: grid;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  min-height: 44px;
  font-size: var(--font-size-footnote);
}
/* NewTripModal: 4 cols (grip, num, name, remove)
 * EditTripModal: 5 cols (grip, num, name, quota, remove) */
.tp-new-dest-row { grid-template-columns: 24px 28px 1fr auto; }
.tp-edit-dest-row { grid-template-columns: 24px 28px 1fr auto auto; }
.tp-new-dest-row.is-dragging,
.tp-edit-dest-row.is-dragging {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
}
.tp-new-dest-grip,
.tp-edit-dest-grip {
  cursor: grab;
  color: var(--color-muted);
  display: grid; place-items: center;
  width: 24px; height: 24px;
  border: 0; background: transparent;
}
.tp-new-dest-grip:active,
.tp-edit-dest-grip:active { cursor: grabbing; }
.tp-new-dest-grip .svg-icon,
.tp-edit-dest-grip .svg-icon { width: 14px; height: 14px; }
.tp-new-dest-num,
.tp-edit-dest-num {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: grid; place-items: center;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  font-weight: 700;
  font-size: var(--font-size-caption);
}
.tp-new-dest-name,
.tp-edit-dest-name {
  min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 600;
  color: var(--color-foreground);
}
.tp-new-dest-remove,
.tp-edit-dest-remove {
  width: 28px; height: 28px;
  border: 0; background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  border-radius: 50%;
  display: grid; place-items: center;
}
.tp-new-dest-remove:hover,
.tp-edit-dest-remove:hover { background: var(--color-hover); color: var(--color-destructive); }
.tp-new-dest-remove .svg-icon,
.tp-edit-dest-remove .svg-icon { width: 14px; height: 14px; }

/* ===== POI search dropdown ===== */
.tp-new-dest-dropdown,
.tp-edit-dest-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  z-index: 3;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  max-height: 280px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.tp-new-dest-status,
.tp-edit-dest-status {
  padding: 14px 16px;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  text-align: center;
}
.tp-new-dest-result,
.tp-edit-dest-result {
  display: flex; flex-direction: column; gap: 2px;
  width: 100%;
  padding: 10px 14px;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 120ms;
}
.tp-new-dest-result:last-child,
.tp-edit-dest-result:last-child { border-bottom: 0; }
.tp-new-dest-result:hover,
.tp-edit-dest-result:hover { background: var(--color-accent-subtle); }
.tp-new-dest-result:focus-visible,
.tp-edit-dest-result:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: -2px;
}
.tp-new-dest-result .name,
.tp-edit-dest-result .name {
  font-size: var(--font-size-callout); font-weight: 700;
  color: var(--color-foreground);
  line-height: 1.3;
}
.tp-new-dest-result .addr,
.tp-edit-dest-result .addr {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  line-height: 1.4;
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
}

/* ===== Segmented control (NewTripModal date mode + EditTripModal travel mode) ===== */
.tp-new-segmented,
.tp-edit-segment {
  display: inline-flex; gap: 0;
  padding: 4px; border-radius: var(--radius-full);
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  align-self: stretch;
}
.tp-new-segmented button,
.tp-edit-segment button {
  flex: 1;
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 10px 16px; border-radius: var(--radius-full);
  border: none; background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  transition: all 0.15s;
  /* H4: Apple HIG 44px tap target — keep 44px even inside the 4px-padded
   * segmented chrome so the inner button itself remains tappable. */
  min-height: var(--spacing-tap-min);
}
.tp-new-segmented button.is-active,
.tp-edit-segment button.is-active {
  /* QA 2026-04-26 BUG-029：原本只有 --shadow-sm 對比度不夠，加 accent border
   * + 升 --shadow-md 讓 active state 一眼看得出。仍守 mockup「白底 active」 base。 */
  background: var(--color-background);
  color: var(--color-accent-deep);
  box-shadow: var(--shadow-md), inset 0 0 0 1.5px var(--color-accent);
}
.tp-new-segmented button:hover:not(.is-active),
.tp-edit-segment button:hover:not(.is-active) { color: var(--color-foreground); }

/* ===== Sticky CTA actions row ===== */
.tp-new-modal-actions,
.tp-edit-actions {
  position: sticky;
  bottom: 0;
  display: flex; gap: 8px; align-items: center;
  margin: 20px -24px 0;
  padding: 16px 24px max(16px, env(safe-area-inset-bottom, 16px));
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-background) 94%, transparent);
  backdrop-filter: blur(var(--blur-glass, 14px));
  -webkit-backdrop-filter: blur(var(--blur-glass, 14px));
}
.tp-new-modal-actions { justify-content: flex-end; }
.tp-edit-actions { justify-content: space-between; flex-wrap: wrap; }
@media (min-width: 768px) {
  .tp-new-modal-actions,
  .tp-edit-actions {
    margin-left: -32px; margin-right: -32px;
    padding-left: 32px; padding-right: 32px;
  }
}

/* ===== Primary / secondary buttons ===== */
.tp-new-modal-btn,
.tp-edit-btn {
  padding: 12px 20px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-foreground);
  font: inherit; font-weight: 600;
  font-size: var(--font-size-callout);
  cursor: pointer;
  min-height: var(--spacing-tap-min);
  transition: filter 120ms;
}
.tp-new-modal-btn:hover:not(:disabled),
.tp-edit-btn:hover:not(:disabled) { background: var(--color-hover); }
.tp-new-modal-btn-primary,
.tp-edit-btn-primary {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  border-color: var(--color-accent);
}
.tp-new-modal-btn-primary:hover:not(:disabled),
.tp-edit-btn-primary:hover:not(:disabled) {
  filter: brightness(var(--hover-brightness, 0.95));
}
.tp-new-modal-btn:disabled,
.tp-edit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;
