/**
 * EntryActionPopover — V3 ⎘ copy / ⇅ move popover.
 *
 * v2.9 PR3：純 UI mockup with disabled confirm（端點還沒 ship）。
 * v2.10 Wave 1：backend 上線 — confirm 接 onConfirm callback：
 *   - Copy: POST /api/trips/:id/entries/:eid/copy { targetDayId, sortOrder?, time? }
 *   - Move: PATCH /api/trips/:id/entries/:eid { day_id, sort_order? }
 *
 * `onConfirm` 由 caller（RailRow）提供 — popover 本身不知道是 copy 還是 move
 * 怎麼打 API，只負責收集 user 選擇 + 觸發 callback。
 */
import { useEffect, useState } from 'react';
import { dayColor } from '../../lib/dayPalette';

const SCOPED_STYLES = `
.tp-action-popover {
  position: absolute; right: 0; top: calc(100% + 6px);
  width: 280px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 60;
  padding: 14px;
  animation: tp-action-pop-in 120ms var(--transition-timing-function-apple, ease-out);
}
@keyframes tp-action-pop-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.tp-action-head {
  font-size: var(--font-size-eyebrow); font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--color-muted);
  margin: 0 0 10px;
}
.tp-action-day-list {
  display: flex; flex-direction: column; gap: 4px;
  max-height: 240px; overflow-y: auto;
}
.tp-action-day {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  min-height: var(--spacing-tap-min);
  border: 1px solid transparent;
  background: transparent;
  font: inherit;
  text-align: left;
  width: 100%;
  color: var(--color-foreground);
}
.tp-action-day:hover:not([aria-disabled="true"]) {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent-bg);
}
.tp-action-day[aria-pressed="true"] {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
}
.tp-action-day[aria-disabled="true"] {
  opacity: 0.4;
  cursor: not-allowed;
}
.tp-action-swatch { width: 12px; height: 12px; border-radius: var(--radius-full); flex-shrink: 0; }
.tp-action-day-label { flex: 1; font-size: var(--font-size-callout); font-weight: 600; }
.tp-action-day-count { font-size: var(--font-size-caption); color: var(--color-muted); }

.tp-action-time-row {
  margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
}
.tp-action-time-label {
  font-size: var(--font-size-caption); color: var(--color-muted);
  text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;
  margin-bottom: 6px; display: block;
}
.tp-action-time-select {
  width: 100%; font: inherit; font-size: var(--font-size-callout); font-weight: 600;
  padding: 10px 12px; border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: var(--color-secondary);
  min-height: var(--spacing-tap-min);
  color: var(--color-foreground);
}
.tp-action-time-select:focus {
  outline: none; border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}

.tp-action-cta {
  display: flex; gap: 8px; margin-top: 12px; padding-top: 12px;
  border-top: 1px solid var(--color-border);
}
.tp-action-cta button {
  flex: 1; font: inherit; font-size: var(--font-size-footnote); font-weight: 700;
  border: 0; padding: 10px; border-radius: var(--radius-full);
  cursor: pointer; min-height: var(--spacing-tap-min);
}
.tp-action-cta .cancel { background: var(--color-secondary); color: var(--color-muted); }
.tp-action-cta .cancel:hover { background: var(--color-tertiary); color: var(--color-foreground); }
.tp-action-cta .confirm { background: var(--color-accent); color: var(--color-accent-foreground); }
.tp-action-cta .confirm:hover:not(:disabled) { filter: brightness(0.95); }
.tp-action-cta .confirm:disabled { opacity: 0.5; cursor: not-allowed; }

.tp-action-pending-note {
  margin: 10px 0 0;
  padding: 8px 10px;
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-caption);
  color: var(--color-warning);
  line-height: 1.4;
}
`;

const TIME_SLOTS = [
  { key: 'same', label: '同原時段' },
  { key: 'morning', label: '09:00 — 11:30（早上第一站）' },
  { key: 'noon', label: '12:00 — 13:30（午餐）' },
  { key: 'afternoon', label: '14:00 — 16:30（午後）' },
  { key: 'evening', label: '18:00 — 20:00（晚餐）' },
  { key: 'custom', label: '自訂時段…' },
] as const;

export interface DayOption {
  dayNum: number;
  dayId: number;
  label: string;
  stopCount: number;
  /** Tailwind -500 hex used as the day's accent swatch. */
  swatchColor?: string;
}

export interface EntryActionConfirmPayload {
  targetDayId: number;
  /** key from TIME_SLOTS — caller decides how to map to time string. */
  timeSlot: string;
}

export interface EntryActionPopoverProps {
  open: boolean;
  action: 'copy' | 'move';
  days: DayOption[];
  /** dayId of the entry being copied/moved — disabled in the picker. */
  currentDayId: number;
  onClose: () => void;
  /** v2.10 Wave 1: backend 上線後的 confirm callback。Omit → 顯示 disabled
   *  + 「即將推出」（保留 v2.9 PR3 的 mock 行為，給 standalone test 用）。 */
  onConfirm?: (payload: EntryActionConfirmPayload) => Promise<void>;
}

export default function EntryActionPopover({ open, action, days, currentDayId, onClose, onConfirm }: EntryActionPopoverProps) {
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [timeSlot, setTimeSlot] = useState<string>('same');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const heading = action === 'copy' ? '複製到哪一天' : '移動到哪一天';
  const ctaLabel = action === 'copy' ? '複製' : '移動';
  const pendingHint = action === 'copy'
    ? 'Copy 端點即將推出（POST /entries/:eid/copy）'
    : 'Move 端點即將推出（PATCH 加 day_id）';

  const isWired = !!onConfirm;
  const canConfirm = isWired && selectedDayId != null && !submitting;

  async function handleConfirm() {
    if (!onConfirm || selectedDayId == null) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({ targetDayId: selectedDayId, timeSlot });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失敗');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tp-action-popover" role="dialog" aria-label={heading} data-testid="entry-action-popover">
      <style>{SCOPED_STYLES}</style>
      <h4 className="tp-action-head">{heading}</h4>

      <div className="tp-action-day-list">
        {days.map((d) => {
          const isCurrent = d.dayId === currentDayId;
          const isSelected = selectedDayId === d.dayId;
          return (
            <button
              key={d.dayId}
              type="button"
              className="tp-action-day"
              aria-disabled={isCurrent || undefined}
              aria-pressed={isSelected}
              onClick={() => { if (!isCurrent) setSelectedDayId(d.dayId); }}
              data-testid={`entry-action-day-${d.dayNum}`}
            >
              <span className="tp-action-swatch" style={{ background: d.swatchColor || dayColor(d.dayNum) }} aria-hidden="true" />
              <span className="tp-action-day-label">
                Day {d.dayNum} · {d.label}
                {isCurrent && '（目前）'}
              </span>
              <span className="tp-action-day-count">
                {d.stopCount === 0 ? '空' : `${d.stopCount} 個`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="tp-action-time-row">
        <label className="tp-action-time-label" htmlFor="entry-action-timeslot">{ctaLabel}到時段</label>
        <select
          id="entry-action-timeslot"
          className="tp-action-time-select"
          value={timeSlot}
          onChange={(e) => setTimeSlot(e.target.value)}
          data-testid="entry-action-timeslot"
        >
          {TIME_SLOTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      {!isWired && <p className="tp-action-pending-note">⚠️ {pendingHint} — 此功能即將推出</p>}
      {error && <p className="tp-action-pending-note" role="alert">{error}</p>}

      <div className="tp-action-cta">
        <button
          type="button"
          className="cancel"
          onClick={onClose}
          disabled={submitting}
          data-testid="entry-action-cancel"
        >
          取消
        </button>
        <button
          type="button"
          className="confirm"
          disabled={!canConfirm}
          title={isWired ? (selectedDayId == null ? '請先選擇目標日' : '') : '此功能即將推出，待 backend 端點完成'}
          onClick={isWired ? handleConfirm : undefined}
          data-testid="entry-action-confirm"
        >
          {submitting ? `${ctaLabel}中…` : (isWired ? ctaLabel : `${ctaLabel}（即將推出）`)}
        </button>
      </div>
    </div>
  );
}
