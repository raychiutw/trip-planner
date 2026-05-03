/**
 * TripPickerPopover — anchored popover 從 trip 列表挑一個 (chooser)
 *
 * 2026-05-03 modal-to-fullpage migration audit (chooser branch): 原
 * `tp-trip-picker` modal-style backdrop 改 anchored popover (DESIGN.md
 * 允許 popover 範疇)。改 popover 而非全頁的理由：
 *   - chooser 性質 (selection → 立即 navigate)，page 模式打斷 flow
 *   - URL deep-link 沒意義 (trip 列表是 user-specific dynamic)
 *   - 跟 region-pill / category-subtab 同類 selection menu pattern
 *
 * Anchor: 由 caller 包 `position: relative` wrapper，popover 用
 *   `position: absolute; top: 100%; right: 0`。
 *
 * Behavior:
 *   - open=false 不 render
 *   - 點 row → onPick(tripId) (caller 負責關閉 + 後續 action)
 *   - 點外面 → onClose()  (mousedown listener)
 *   - Esc → onClose()
 *   - 載入中 / 空列表 fallback message
 */
import { useEffect, useRef } from 'react';

export interface TripPickerOption {
  tripId: string;
  name?: string;
  title?: string | null;
  countries?: string | null;
}

interface Props {
  open: boolean;
  trips: TripPickerOption[] | null; // null = loading
  selectedCount: number;
  onPick: (tripId: string) => void;
  onClose: () => void;
}

export default function TripPickerPopover({ open, trips, selectedCount, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  // 點外關閉 + Esc 關閉
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t)) {
        // 同時排除 trigger button (caller 會自己 toggle)
        const trigger = (e.target as HTMLElement).closest('[data-trip-picker-trigger="true"]');
        if (!trigger) onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        ref={ref}
        className="tp-trip-picker-popover"
        role="dialog"
        aria-label="選擇要加入的行程"
        data-testid="explore-trip-picker"
      >
        <div className="tp-trip-picker-header">
          <h3>選擇要加入的行程</h3>
          <p>已選 {selectedCount} 個 POI</p>
        </div>
        <div className="tp-trip-picker-list">
          {trips === null && <div className="tp-trip-picker-empty">載入中…</div>}
          {trips !== null && trips.length === 0 && (
            <div className="tp-trip-picker-empty">你還沒有任何行程，先去新增一個。</div>
          )}
          {trips !== null && trips.map((t) => (
            <button
              key={t.tripId}
              type="button"
              className="tp-trip-picker-row"
              onClick={() => onPick(t.tripId)}
              data-testid={`explore-trip-pick-${t.tripId}`}
            >
              <span className="row-title">{t.title || t.name || t.tripId}</span>
              <span className="row-meta">{(t.countries ?? '').toUpperCase() || '—'}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

const SCOPED_STYLES = `
.tp-trip-picker-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 50;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 14px;
  width: min(320px, calc(100vw - 32px));
  max-height: min(60vh, 420px);
  display: flex; flex-direction: column; gap: 10px;
}
.tp-trip-picker-header h3 {
  font-size: var(--font-size-callout);
  font-weight: 700;
  margin: 0 0 2px;
}
.tp-trip-picker-header p {
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
  margin: 0;
}
.tp-trip-picker-list {
  flex: 1; min-height: 0;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
}
.tp-trip-picker-row {
  text-align: left;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  font: inherit; cursor: pointer;
  display: flex; flex-direction: column; gap: 2px;
}
.tp-trip-picker-row:hover { border-color: var(--color-accent); background: var(--color-hover); }
.tp-trip-picker-row .row-title { font-weight: 700; font-size: var(--font-size-footnote); }
.tp-trip-picker-row .row-meta {
  color: var(--color-muted);
  font-size: var(--font-size-caption);
  letter-spacing: 0.04em;
}
.tp-trip-picker-empty {
  padding: 16px; text-align: center; color: var(--color-muted);
  font-size: var(--font-size-footnote);
}

/* Mobile (≤760px): full-width attached to bottom of trigger row, but
 * keep popover style (not bottom-sheet) — caller's toolbar 已 sticky bottom，
 * 不適合再開 sheet。 */
@media (max-width: 760px) {
  .tp-trip-picker-popover {
    right: 0; left: auto;
    width: min(320px, calc(100vw - 24px));
  }
}
`;
