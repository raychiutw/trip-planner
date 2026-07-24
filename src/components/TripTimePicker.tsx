/**
 * TripTimePicker — terracotta-themed time picker (replaces native type="time").
 *
 * Variant: tp-input-short solo trigger (22px bold center, 44px tap target).
 * Popover: two-column scrolling lists (hour 00-23 + minute 00/05/10/.../55).
 * Wraps `@headlessui/react` Popover for portal positioning + outside-click + a11y.
 *
 * I/O: "HH:MM" string. Empty string ("") => placeholder shown.
 */
import { useEffect, useId, useMemo, useRef } from 'react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';

import { TRIP_TIME_PICKER_STYLES } from './TripTimePicker.styles';

export interface TripTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Minute step (default 5). Use 1 for minute-precise input. */
  minuteStep?: 1 | 5 | 10 | 15 | 30;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  required?: boolean;
  /** popover 內顯示「清除時間」按鈕，把值重設為空字串（""）。預設 false。 */
  clearable?: boolean;
  /**
   * 12/24 制覆寫。預設 undefined → 跟系統（Intl hourCycle）。傳明確 boolean 可強制
   * （測試求確定性用；app 不傳、跟使用者 OS/locale）。
   */
  hour12?: boolean;
  className?: string;
  id?: string;
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
// 12h clock 顯示序：12, 1..11（12 代表 12 點 AM/PM）。
const HOURS_12 = ['12', ...Array.from({ length: 11 }, (_, i) => String(i + 1).padStart(2, '0'))];
const PERIODS = ['AM', 'PM'] as const;
type Period = (typeof PERIODS)[number];

/** 系統是否 12 小時制（Intl hourCycle，跟隨 OS/locale；TW 多為 24h）。 */
function detectHour12(): boolean {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false;
  } catch {
    return false;
  }
}

/** 24h "HH" → { h12:"01".."12", period }。12 點 → h12="12"。 */
export function to12h(hh24: string): { h12: string; period: Period } {
  const h = Number(hh24);
  const period: Period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { h12: String(h12).padStart(2, '0'), period };
}

/** { h12, period } → 24h "HH"。12 AM=00、12 PM=12。 */
export function to24h(h12: string, period: Period): string {
  const h = Number(h12) % 12; // 12 → 0
  const h24 = period === 'AM' ? h : h + 12;
  return String(h24).padStart(2, '0');
}

/** 依系統制式格式化顯示：24h → "13:30"；12h → "1:30 PM"。 */
export function formatTimeDisplay(hh: string, mm: string, hour12: boolean): string {
  if (!hour12) return `${hh}:${mm}`;
  const { h12, period } = to12h(hh);
  return `${Number(h12)}:${mm} ${period}`;
}

function parseHHMM(s: string): { hh: string; mm: string } | null {
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh: m[1]!, mm: m[2]! };
}

export function TripTimePicker({
  value,
  onChange,
  minuteStep = 5,
  placeholder = '--:--',
  ariaLabel,
  disabled = false,
  required = false,
  clearable = false,
  hour12: hour12Prop,
  className,
  id,
}: TripTimePickerProps) {
  const autoId = useId();
  const triggerId = id ?? `tp-time-${autoId}`;
  // W11：12/24 跟系統（Intl hourCycle）。偵測一次即可（OS 制式不會在頁面存活期間變）；
  // hour12 prop 有傳則覆寫（測試確定性）。
  const detected = useMemo(detectHour12, []);
  const hour12 = hour12Prop ?? detected;
  const parsed = useMemo(() => parseHHMM(value), [value]);
  const display = parsed ? formatTimeDisplay(parsed.hh, parsed.mm, hour12) : placeholder;
  const isPlaceholder = !parsed;

  const minutes = useMemo(
    () =>
      Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) =>
        String(i * minuteStep).padStart(2, '0'),
      ),
    [minuteStep],
  );

  const hourColRef = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);

  return (
    <Popover className={`tp-time-picker ${className ?? ''}`.trim()}>
      {({ open, close }) => (
        <TimePickerBody
          open={open}
          close={close}
          triggerId={triggerId}
          ariaLabel={ariaLabel}
          required={required}
          disabled={disabled}
          display={display}
          isPlaceholder={isPlaceholder}
          parsed={parsed}
          minutes={minutes}
          hour12={hour12}
          hourColRef={hourColRef}
          minuteColRef={minuteColRef}
          onChange={onChange}
          clearable={clearable}
        />
      )}
    </Popover>
  );
}

interface TimePickerBodyProps {
  open: boolean;
  close: () => void;
  triggerId: string;
  ariaLabel?: string;
  required: boolean;
  disabled: boolean;
  display: string;
  isPlaceholder: boolean;
  parsed: { hh: string; mm: string } | null;
  minutes: string[];
  hour12: boolean;
  hourColRef: React.RefObject<HTMLDivElement | null>;
  minuteColRef: React.RefObject<HTMLDivElement | null>;
  onChange: (value: string) => void;
  clearable: boolean;
}

function TimePickerBody({
  open,
  close,
  triggerId,
  ariaLabel,
  required,
  disabled,
  display,
  isPlaceholder,
  parsed,
  minutes,
  hour12,
  hourColRef,
  minuteColRef,
  onChange,
  clearable,
}: TimePickerBodyProps) {
  // Scroll selected items into center when popover opens.
  // headlessui PopoverPanel renders via portal — refs ready after open=true commit
  // but layout/scroll may not be ready in same tick. setTimeout(50ms) waits for
  // popover transition + layout calc + paint. v2.33.23 fix (was rAF, unreliable).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      // 12h 模式時 hour cell 的 data-h 是 h12（"01".."12"），要用轉換後的值定位。
      const hh = hour12
        ? to12h(parsed?.hh ?? '00').h12
        : (parsed?.hh ?? '12');
      // If existing minute isn't on a step boundary, scroll to nearest cell.
      const mmTarget = parsed?.mm
        ? minutes.reduce((best, m) =>
            Math.abs(Number(m) - Number(parsed.mm)) < Math.abs(Number(best) - Number(parsed.mm))
              ? m
              : best,
          )
        : '00';
      const hourScroll = hourColRef.current?.querySelector<HTMLElement>('.tp-time-col-scroll');
      const minScroll = minuteColRef.current?.querySelector<HTMLElement>('.tp-time-col-scroll');
      const hourBtn = hourColRef.current?.querySelector<HTMLElement>(`[data-h="${hh}"]`);
      const minBtn = minuteColRef.current?.querySelector<HTMLElement>(`[data-m="${mmTarget}"]`);
      // Use parent scrollTop instead of scrollIntoView (which can scroll page too).
      if (hourScroll && hourBtn) {
        hourScroll.scrollTop = hourBtn.offsetTop - hourScroll.clientHeight / 2 + hourBtn.clientHeight / 2;
      }
      if (minScroll && minBtn) {
        minScroll.scrollTop = minBtn.offsetTop - minScroll.clientHeight / 2 + minBtn.clientHeight / 2;
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [open, parsed, minutes, hour12, hourColRef, minuteColRef]);

  const pick = (hh: string, mm: string) => {
    onChange(`${hh}:${mm}`);
    close();
  };

  // 12h 模式的目前 h12 / period（供 cell selected 判斷與換算落地）。
  const cur12 = parsed ? to12h(parsed.hh) : null;
  const curPeriod: Period = cur12?.period ?? 'AM';
  // 點 12h 小時 cell：組回 24h（沿用目前 period）。點 AM/PM：換 period 重算 24h。
  const pickHour12 = (h12: string) => pick(to24h(h12, curPeriod), parsed?.mm ?? '00');
  const pickPeriod = (p: Period) => pick(to24h(cur12?.h12 ?? '12', p), parsed?.mm ?? '00');

  return (
    <>
      <style>{TRIP_TIME_PICKER_STYLES}</style>
      <PopoverButton
        id={triggerId}
        as="button"
        type="button"
        className={`tp-time-trigger ${isPlaceholder ? 'is-placeholder' : ''}`}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
      >
        <span className="tp-time-value">{display}</span>
        <svg className="tp-time-chev" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: 'bottom start', gap: 8 }}
        className="tp-time-popover"
      >
        <div className="tp-time-cols">
          <div className="tp-time-col" ref={hourColRef} aria-label="小時">
            <div className="tp-time-col-label">時</div>
            <div className="tp-time-col-scroll">
              {(hour12 ? HOURS_12 : HOURS_24).map((h) => {
                // 24h：cell 值即 hh；12h：cell 值是 h12，selected 比對轉換後的 h12。
                const selected = hour12 ? cur12?.h12 === h : parsed?.hh === h;
                return (
                  <button
                    key={h}
                    data-h={h}
                    type="button"
                    className={`tp-time-cell ${selected ? 'is-selected' : ''}`}
                    onClick={() => (hour12 ? pickHour12(h) : pick(h, parsed?.mm ?? '00'))}
                  >
                    {hour12 ? String(Number(h)) : h}
                  </button>
                );
              })}
            </div>
          </div>
          {/* 12h 模式才有 AM/PM 欄（24h 無此概念）。 */}
          {hour12 && (
            <div className="tp-time-col tp-time-col--period" aria-label="上午/下午">
              <div className="tp-time-col-label">&nbsp;</div>
              <div className="tp-time-col-scroll">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    data-period={p}
                    type="button"
                    className={`tp-time-cell ${curPeriod === p ? 'is-selected' : ''}`}
                    onClick={() => pickPeriod(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="tp-time-col" ref={minuteColRef} aria-label="分鐘">
            <div className="tp-time-col-label">分</div>
            <div className="tp-time-col-scroll">
              {minutes.map((mm) => {
                const selected = parsed?.mm === mm;
                return (
                  <button
                    key={mm}
                    data-m={mm}
                    type="button"
                    className={`tp-time-cell ${selected ? 'is-selected' : ''}`}
                    onClick={() => pick(parsed?.hh ?? '12', mm)}
                  >
                    {mm}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {clearable && !isPlaceholder && (
          <div className="tp-time-footer">
            <button
              type="button"
              className="tp-time-clear"
              onClick={() => { onChange(''); close(); }}
              data-testid="tp-time-clear"
            >
              清除時間
            </button>
          </div>
        )}
      </PopoverPanel>
    </>
  );
}
