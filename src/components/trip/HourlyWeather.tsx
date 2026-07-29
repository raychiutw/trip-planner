import { useState, useEffect, useCallback, useRef, memo } from 'react';
import clsx from 'clsx';
import Icon from '../shared/Icon';
import { ARROW_EXPAND, ARROW_COLLAPSE } from '../../lib/constants';
import {
  WMO,
  makeDefaultMg,
  fetchWeatherForDay,
} from '../../lib/weather';
import type { WeatherDay, MergedHourly } from '../../lib/weather';

/* ===== Props ===== */

interface HourlyWeatherProps {
  /** Day ID used for keying. */
  dayId: number;
  /** One-based day number used to cycle preview information. */
  dayNum: number;
  /** The day's date string (ISO format "YYYY-MM-DD"). */
  dayDate?: string;
  /** Weather location data for the day. */
  weatherDay: WeatherDay | null;
  /** Trip start date (ISO format). */
  tripStart?: string | null;
  /** Trip end date (ISO format). */
  tripEnd?: string | null;
  /** IANA timezone for the trip destination (default: 'Asia/Tokyo'). */
  timezone?: string;
}

/* ===== Helpers ===== */

/** Return the number of calendar days between today and a date string "YYYY-MM-DD". */
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** 降雨量顯示：mm/h 常是 0.1~數 mm 的小數，整數會全變 0。
 *  <10 保留一位小數（0.7），>=10 取整（12）—— 大雨時小數沒有意義。 */
function fmtMm(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0';
  return v < 10 ? v.toFixed(1) : String(Math.round(v));
}

// 16 天以外沒有預報時顯示的示意值。v2.57.84 降雨單位從 % 改 mm/h，數值一起改成
// 符合標籤的量級 —— 原本 20/30/40 是百分比，直接換單位會變成「20mm」（那是豪雨）。
const WEATHER_PREVIEWS = [
  { icon: 'weather-sun-cloud', temp: 28, label: '晴時多雲', rain: 0 },
  { icon: 'weather-cloudy', temp: 27, label: '多雲', rain: 0 },
  { icon: 'weather-clear', temp: 29, label: '晴朗', rain: 0 },
  { icon: 'weather-rain-sun', temp: 26, label: '短暫陣雨', rain: 1.2 },
] as const;

function WeatherPreview({
  dayId,
  dayNum,
  reason,
}: {
  dayId: number;
  dayNum: number;
  reason: string;
}) {
  const preview = WEATHER_PREVIEWS[(Math.max(dayNum, 1) - 1) % WEATHER_PREVIEWS.length]!;
  return (
    <div className="py-3 overflow-hidden" id={`hourly-${dayId}`}>
      <div className="flex items-center gap-2 py-2 px-3 -mx-3 rounded-sm bg-accent-bg text-subheadline">
        <Icon name={preview.icon} />
        <span className="text-foreground">
          {preview.temp}°C · {preview.label} · 降雨 {preview.rain}mm
        </span>
        <span className="ml-auto shrink-0 text-muted">天氣示意</span>
      </div>
      <div className="pt-1 text-callout text-muted">{reason}</div>
    </div>
  );
}

/* ===== Component ===== */

const HourlyWeather = memo(function HourlyWeather({
  dayId,
  dayNum,
  dayDate,
  weatherDay,
  tripStart,
  tripEnd,
  timezone,
}: HourlyWeatherProps) {
  /* --- Days until this day (computed at render time) --- */
  const diff = dayDate ? daysUntil(dayDate) : 0;
  const tooFarAway = diff > 16;
  const hasForecastLocation = Boolean(weatherDay?.locations.length);

  /* --- Location count (for detail panel label) --- */
  const locCount = new Set(weatherDay?.locations.map((l) => l.name) ?? []).size;

  /* --- All hooks declared unconditionally (Rules of Hooks) --- */
  const [mg, setMg] = useState<MergedHourly | null>(null);
  const [loading, setLoading] = useState(Boolean(dayDate && hasForecastLocation && !tooFarAway));
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  /* --- Fetch weather data on mount — skipped when tooFarAway --- */
  useEffect(() => {
    if (tooFarAway || !dayDate || !weatherDay?.locations.length) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchWeatherForDay(dayDate, weatherDay, tripStart, tripEnd, timezone)
      .then((data) => {
        if (!cancelled) {
          setMg(data);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dayId, dayDate, tripStart, tripEnd, tooFarAway, timezone, weatherDay]);

  /* --- Toggle expand/collapse --- */
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const nextOpen = !prev;
      // When opening, scroll the grid to the current hour block
      if (nextOpen) {
        requestAnimationFrame(() => {
          const grid = gridRef.current;
          if (!grid) return;
          const now = new Date().getHours();
          const nowBlock = grid.querySelector<HTMLElement>(
            `[data-hour="${Math.max(6, Math.min(21, now))}"]`,
          );
          if (nowBlock) {
            grid.scrollLeft = nowBlock.offsetLeft - grid.offsetLeft;
          }
        });
      }
      return nextOpen;
    });
  }, []);

  if (!hasForecastLocation) {
    return <WeatherPreview dayId={dayId} dayNum={dayNum} reason="尚無可用預報位置" />;
  }

  if (!dayDate) {
    return <WeatherPreview dayId={dayId} dayNum={dayNum} reason="目前沒有可用預報" />;
  }

  /* ===== State A: more than 16 days away — no API call ===== */
  if (tooFarAway) {
    return <WeatherPreview dayId={dayId} dayNum={dayNum} reason="天氣預報將於出發前 16 天開放" />;
  }

  /* --- Loading state --- */
  if (loading) {
    return <WeatherPreview dayId={dayId} dayNum={dayNum} reason="正在更新預報" />;
  }

  /* --- Error state --- */
  if (error) {
    return <WeatherPreview dayId={dayId} dayNum={dayNum} reason="暫時無法取得預報" />;
  }

  /* --- Resolve data --- */
  const data = mg || makeDefaultMg();

  /* --- Detect whether data is meaningful (not all-zero placeholder) --- */
  const hasData = data.temps.some((t) => t !== 0);

  /* ===== State B: within 16 days but API returned all-zero data ===== */
  if (!hasData) {
    return <WeatherPreview dayId={dayId} dayNum={dayNum} reason="目前沒有可用預報" />;
  }

  /* ===== State C: has real data — normal display ===== */

  const now = new Date();
  const currentHour = now.getHours();
  let minT = 99;
  let maxT = -99;
  let minR = 100;
  let maxR = 0;
  const iconCount: Record<string, number> = {};
  let bestIcon = 'weather-clear';

  for (let h = 0; h < 24; h++) {
    const t = Math.round(data.temps[h]!);
    const r = data.rains[h]!;
    const ic = WMO[data.codes[h]!] || 'question';
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    iconCount[ic] = (iconCount[ic] ?? 0) + 1;
  }

  // v2.33.45 round 6b: for-in 對 Record 不安全（會 iterate prototype keys）。
  // 改 Object.entries 對 strict mode 友善。
  let maxCnt = 0;
  for (const [k, cnt] of Object.entries(iconCount)) {
    if (cnt > maxCnt) {
      maxCnt = cnt;
      bestIcon = k;
    }
  }

  /* --- Render State C --- */
  return (
    <div
      className="py-3 overflow-hidden"
      id={`hourly-${dayId}`}
    >
      {/* Summary row (clickable) */}
      <div
        className="flex justify-start items-center gap-2 py-2 px-3 -mx-3 text-subheadline text-muted select-none cursor-pointer rounded-sm transition-colors duration-fast ease-apple hover:text-accent hover:bg-hover focus-visible:outline-none"
        data-action="toggle-hw"
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={isOpen ? '收合天氣' : '展開天氣'}
        onClick={handleToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}
      >
        <Icon name={bestIcon} />{' '}
        {minT}~{maxT}&deg;C{' '}
        &nbsp;&middot;&nbsp;{' '}
        <Icon name="raindrop" />
        {fmtMm(minR)}~{fmtMm(maxR)}mm{' '}
        <span className="ml-auto shrink-0 font-bold text-subheadline text-muted">
          {isOpen ? ARROW_COLLAPSE : ARROW_EXPAND}
        </span>
      </div>

      {/* Detail panel */}
      <div className={isOpen ? 'block' : 'hidden'}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-subheadline font-semibold text-muted">
            <Icon name="timer" /> 逐時預報（{locCount} 個地點）
          </span>
          <span className="text-subheadline text-muted">
            {currentHour}:{String(now.getMinutes()).padStart(2, '0')}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pt-1 pb-1 scroll-smooth" ref={gridRef}>
          {Array.from({ length: 24 }, (_, h) => {
            const wIcon = WMO[data.codes[h]!] || 'question';
            const temp = Math.round(data.temps[h]!);
            const rain = data.rains[h]!;
            const isNow = h === currentHour;

            return (
              <div
                key={h}
                className={clsx(
                  'bg-background rounded-sm py-2 px-1 text-center min-w-[52px] shrink-0',
                  // 「現在這一小時」的強調環，不是焦點指示 —— 原本借用 --shadow-ring，
                  // 那顆 token 已隨慣例 A 退場（#1182），改用 Tailwind 原生 ring，視覺相同。
                  isNow && 'bg-accent-bg ring-2 ring-accent',
                )}
                data-hour={h}
              >
                <div className="text-subheadline font-semibold text-muted mb-1">
                  {isNow ? '\u25B6 ' : ''}
                  {h}:00
                </div>
                <div className="flex items-center justify-center gap-1 text-callout font-bold text-foreground leading-tight">
                  <Icon name={wIcon} />
                  <span>{temp}&deg;</span>
                </div>
                <div
                  className={clsx(
                    'text-callout text-accent',
                    rain >= 50 && 'text-foreground font-bold bg-info-bg rounded-xs px-1',
                  )}
                >
                  {fmtMm(rain)}mm
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default HourlyWeather;
