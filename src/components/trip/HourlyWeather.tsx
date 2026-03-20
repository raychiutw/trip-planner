import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../shared/Icon';
import { ARROW_EXPAND, ARROW_COLLAPSE } from '../../lib/constants';
import {
  WMO,
  getLocIdx,
  makeDefaultMg,
  fetchWeatherForDay,
} from '../../lib/weather';
import type { WeatherDay, MergedHourly } from '../../lib/weather';

/* ===== Props ===== */

interface HourlyWeatherProps {
  /** Day ID used for keying. */
  dayId: number;
  /** The day's date string (ISO format "YYYY-MM-DD"). */
  dayDate: string;
  /** Weather location data for the day. */
  weatherDay: WeatherDay;
  /** Trip start date (ISO format). */
  tripStart?: string | null;
  /** Trip end date (ISO format). */
  tripEnd?: string | null;
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

/* ===== Component ===== */

export default function HourlyWeather({
  dayId,
  dayDate,
  weatherDay,
  tripStart,
  tripEnd,
}: HourlyWeatherProps) {
  /* --- Days until this day (computed at render time) --- */
  const diff = daysUntil(dayDate);
  const tooFarAway = diff > 16;

  /* --- Location chain (used by all 3 states) --- */
  const locs = weatherDay.locations
    .map((l) => l.name)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join('\u2192');

  /* --- All hooks declared unconditionally (Rules of Hooks) --- */
  const [mg, setMg] = useState<MergedHourly | null>(null);
  const [loading, setLoading] = useState(!tooFarAway);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const weatherDayRef = useRef(weatherDay);
  weatherDayRef.current = weatherDay;

  /* --- Fetch weather data on mount — skipped when tooFarAway --- */
  useEffect(() => {
    if (tooFarAway) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchWeatherForDay(dayDate, weatherDayRef.current, tripStart, tripEnd)
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
  }, [dayId, dayDate, tripStart, tripEnd, tooFarAway]);

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
          const nowBlock =
            grid.querySelector<HTMLElement>('.hw-now') ||
            grid.querySelector<HTMLElement>(
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

  /* ===== State A: more than 16 days away — no API call ===== */
  if (tooFarAway) {
    return (
      <div className="hourly-weather" id={`hourly-${dayId}`}>
        <div className="hw-summary">
          ☀️ 天氣預報將於出發前 16 天開放 &nbsp;&middot;&nbsp; {locs}
        </div>
      </div>
    );
  }

  /* --- Loading state --- */
  if (loading) {
    return (
      <div className="hourly-weather" id={`hourly-${dayId}`}>
        <div className="hw-loading">
          <Icon name="hourglass" /> 正在載入逐時天氣預報...
        </div>
      </div>
    );
  }

  /* --- Error state --- */
  if (error) {
    return (
      <div className="hourly-weather" id={`hourly-${dayId}`}>
        <div className="hw-error">天氣資料載入失敗：{error}</div>
      </div>
    );
  }

  /* --- Resolve data --- */
  const data = mg || makeDefaultMg();

  /* --- Detect whether data is meaningful (not all-zero placeholder) --- */
  const hasData = data.temps.some((t) => t !== 0);

  /* ===== State B: within 16 days but API returned all-zero data ===== */
  if (!hasData) {
    return (
      <div className="hourly-weather" id={`hourly-${dayId}`}>
        <div className="hw-summary">
          ☁️ 超出預報範圍，暫無資料 &nbsp;&middot;&nbsp; {locs}
        </div>
      </div>
    );
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
    const t = Math.round(data.temps[h]);
    const r = data.rains[h];
    const ic = WMO[data.codes[h]] || 'question';
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    iconCount[ic] = (iconCount[ic] || 0) + 1;
  }

  let maxCnt = 0;
  for (const k in iconCount) {
    if (iconCount[k] > maxCnt) {
      maxCnt = iconCount[k];
      bestIcon = k;
    }
  }

  /* --- Render State C --- */
  return (
    <div
      className={`hourly-weather${isOpen ? ' hw-open' : ''}`}
      id={`hourly-${dayId}`}
    >
      {/* Summary row (clickable) */}
      <div className="hw-summary" data-action="toggle-hw" onClick={handleToggle} role="button" tabIndex={0} aria-label="展開每小時天氣" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}>
        <Icon name={bestIcon} />{' '}
        {minT}~{maxT}&deg;C{' '}
        &nbsp;&middot;&nbsp;{' '}
        <Icon name="raindrop" />
        {minR}~{maxR}%{' '}
        &nbsp;&middot;&nbsp; {locs}
        <span className="hw-summary-arrow">
          {isOpen ? ARROW_COLLAPSE : ARROW_EXPAND}
        </span>
      </div>

      {/* Detail panel */}
      <div className="hw-detail">
        <div className="hourly-weather-header">
          <span className="hourly-weather-title">
            <Icon name="timer" /> 7日內預報 &mdash; {weatherDay.label}
          </span>
          <span className="hw-update-time">
            {currentHour}:{String(now.getMinutes()).padStart(2, '0')}
          </span>
        </div>
        <div className="hw-grid" ref={gridRef}>
          {Array.from({ length: 24 }, (_, h) => {
            const li = getLocIdx(weatherDay, h);
            const wIcon = WMO[data.codes[h]] || 'question';
            const temp = Math.round(data.temps[h]);
            const rain = data.rains[h];
            const isNow = h === currentHour;

            return (
              <div
                key={h}
                className={`hw-block${isNow ? ' hw-now' : ''}`}
                data-hour={h}
              >
                <div className="hw-block-time">
                  {isNow ? '\u25B6 ' : ''}
                  {h}:00
                </div>
                {weatherDay.locations.length > 1 && (
                  <div className={`hw-block-loc hw-loc-${li}`}>
                    {weatherDay.locations[li].name}
                  </div>
                )}
                <div className="hw-block-icon">
                  <Icon name={wIcon} />
                </div>
                <div className="hw-block-temp">{temp}&deg;C</div>
                <div
                  className={`hw-block-rain${rain >= 50 ? ' hw-rain-high' : ''}`}
                >
                  <Icon name="raindrop" />
                  {rain}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
