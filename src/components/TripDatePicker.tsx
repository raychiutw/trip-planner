/**
 * TripDatePicker — terracotta-themed date picker (replaces native type="date").
 *
 * Variant B Spacious mockup (44px cell, 20px padding, shadow-lg).
 * Wraps `react-day-picker` and exposes ISO string ("YYYY-MM-DD") I/O so existing
 * callsites that pass strings stay drop-in compatible.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

import { TRIP_DATE_PICKER_STYLES } from './TripDatePicker.styles';

export interface TripDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  id?: string;
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_LABELS = [
  '1 月', '2 月', '3 月', '4 月', '5 月', '6 月',
  '7 月', '8 月', '9 月', '10 月', '11 月', '12 月',
];

function parseISO(s: string): Date | undefined {
  if (!s) return undefined;
  const parts = s.split('-');
  if (parts.length !== 3) return undefined;
  const y = Number.parseInt(parts[0]!, 10);
  const m = Number.parseInt(parts[1]!, 10);
  const d = Number.parseInt(parts[2]!, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function TripDatePicker({
  value,
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  placeholder = '選擇日期',
  ariaLabel,
  className,
  id,
}: TripDatePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const autoId = useId();
  const triggerId = id ?? `tp-date-${autoId}`;
  const popoverId = `${triggerId}-popover`;

  const selected = useMemo(() => parseISO(value), [value]);
  const fromDate = useMemo(() => parseISO(min ?? ''), [min]);
  const toDate = useMemo(() => parseISO(max ?? ''), [max]);
  const defaultMonth = selected ?? fromDate ?? new Date();

  const close = useCallback(() => setOpen(false), []);
  const popoverRef = useRef<HTMLDivElement>(null);

  /* owner 2026-07-22「行程航班的月曆會被外框壓住無法看到全部日期」的第二層。
   *
   * 第一層是 .tp-notes-section 的 overflow:hidden 把 popover 裁掉（已移除）。
   * 但 preview 實測發現 popover 底部仍會超出 .app-shell-sheet 的可視區
   * （量到 71px）—— 那層是 overflow:auto 捲得到，可是要使用者自己捲。
   *
   * block:'nearest' 的語意正是「已經看得到就不要動」，所以空間足夠時完全不會
   * 產生多餘捲動（不搶使用者原本的捲動位置），只有真的被切到才補那一段。 */
  useEffect(() => {
    if (!open) return;
    // `?.scrollIntoView?.(` 的第二個 ?. 不是多餘的：jsdom 沒有實作這個方法，
    // 直接呼叫會讓每一個 render 這個元件的測試都爆掉（實測打壞 3 個既有測試）。
    // 捲動是純錦上添花，環境沒有就安靜跳過。
    popoverRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, close]);

  const handleSelect = (day: Date | undefined) => {
    if (!day) return;
    onChange(toISO(day));
    close();
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className={`tp-date-picker ${className ?? ''}`.trim()}>
      <style>{TRIP_DATE_PICKER_STYLES}</style>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={`tp-date-trigger ${open ? 'is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`tp-date-value ${value ? '' : 'is-placeholder'}`}>
          {value || placeholder}
        </span>
        <svg className="tp-date-chev" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-label={ariaLabel ?? '選擇日期'}
          className="tp-date-popover"
        >
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={defaultMonth}
            onSelect={handleSelect}
            startMonth={fromDate}
            endMonth={toDate}
            disabled={[
              ...(fromDate ? [{ before: fromDate }] : []),
              ...(toDate ? [{ after: toDate }] : []),
            ]}
            showOutsideDays
            weekStartsOn={0}
            formatters={{
              formatWeekdayName: (date: Date) => WEEKDAY_LABELS[date.getDay()] ?? '',
              formatCaption: (month: Date) =>
                `${month.getFullYear()} 年 ${MONTH_LABELS[month.getMonth()] ?? ''}`,
            }}
            labels={{
              labelNext: () => '下個月',
              labelPrevious: () => '上個月',
            }}
          />
        </div>
      )}
    </div>
  );
}
