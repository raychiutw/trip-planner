/**
 * TripSheetContent — renders the active sheet's content based on `activeSheet`.
 * Extracted from TripPage.tsx to reduce file size.
 */

import React, { useMemo } from 'react';
import clsx from 'clsx';
import DocCard from './DocCard';
import TodayRouteSheet from './TodayRouteSheet';
import { TripDrivingStatsCard } from './DrivingStats';
import { toTimelineEntry } from '../../lib/mapDay';
import { COLOR_MODE_OPTIONS, THEME_ACCENTS, COLOR_THEMES } from '../../lib/appearance';
import type { Day, TripListItem } from '../../types/trip';
import type { DocEntry } from './DocCard';
import type { ColorMode, ColorTheme } from '../../hooks/useDarkMode';
import type { TripDrivingStats } from '../../lib/drivingStats';

/* ===== Sheet content config ===== */

export const SHEET_TITLES: Record<string, string> = {
  flights: '航班資訊',
  checklist: '出發前確認',
  backup: '備案',
  emergency: '緊急聯絡',
  suggestions: 'AI 解籤',
  driving: '交通統計',
  'today-route': '今日路線',
  'trip-select': '切換行程',
  appearance: '外觀與主題',
  prep: '行前準備',
  'emergency-group': '緊急應變',
  'ai-group': 'AI 分析',
};

/** Pre-built style objects for theme swatches (avoid per-render allocation). */
const SWATCH_STYLES: Record<string, { light: React.CSSProperties; dark: React.CSSProperties }> =
  Object.fromEntries(
    Object.entries(THEME_ACCENTS).map(([key, { light, dark }]) => [
      key,
      { light: { background: light }, dark: { background: dark } },
    ]),
  );

const LOADING_CLASS = 'text-center p-10 text-muted';

/* ===== Props ===== */

interface TripSheetContentProps {
  activeSheet: string | null;
  docs: Record<string, unknown>;
  tripDrivingStats: TripDrivingStats | null;
  currentDay: Day | null;
  sheetTrips: TripListItem[];
  sheetTripsLoading: boolean;
  activeTripId: string | null;
  onTripChange: (tripId: string) => void;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  colorTheme: ColorTheme;
  setTheme: (theme: ColorTheme) => void;
  isDark: boolean;
}

/* ===== Component ===== */

export default function TripSheetContent({
  activeSheet,
  docs,
  tripDrivingStats,
  currentDay,
  sheetTrips,
  sheetTripsLoading,
  activeTripId,
  onTripChange,
  colorMode,
  setColorMode,
  colorTheme,
  setTheme,
  isDark,
}: TripSheetContentProps) {
  const content = useMemo(() => {
    if (!activeSheet) return null;
    switch (activeSheet) {
      /* Individual content */
      case 'flights':
      case 'checklist':
      case 'backup':
      case 'emergency':
      case 'suggestions': {
        const docData = docs[activeSheet] as { title?: string; entries?: DocEntry[] } | undefined;
        return docData?.entries?.length
          ? <DocCard entries={docData.entries} />
          : <p className="text-callout text-muted text-center py-4">尚無資料</p>;
      }
      case 'today-route':
        return currentDay && currentDay.timeline.length > 0
          ? <TodayRouteSheet events={currentDay.timeline.map((e) => typeof e === 'object' && e !== null ? toTimelineEntry(e) : toTimelineEntry({}))} />
          : <p>無行程資料</p>;
      case 'driving':
        return tripDrivingStats
          ? <TripDrivingStatsCard tripStats={tripDrivingStats} />
          : <p>無交通資料</p>;
      /* Grouped content */
      case 'prep':
        return (
          <>
            {(['flights', 'checklist'] as const).map(k => {
              const d = docs[k] as { title?: string; entries?: DocEntry[] } | undefined;
              return <div key={k} className="bg-secondary rounded-md p-4 mb-3">{d?.entries?.length ? <DocCard entries={d.entries} /> : <p className="text-muted">尚無資料</p>}</div>;
            })}
          </>
        );
      case 'emergency-group':
        return (
          <>
            {(['emergency', 'backup'] as const).map(k => {
              const d = docs[k] as { title?: string; entries?: DocEntry[] } | undefined;
              return <div key={k} className="bg-secondary rounded-md p-4 mb-3">{d?.entries?.length ? <DocCard entries={d.entries} /> : <p className="text-muted">尚無資料</p>}</div>;
            })}
          </>
        );
      case 'ai-group':
        return (
          <>
            {(() => { const d = docs.suggestions as { title?: string; entries?: DocEntry[] } | undefined; return <div className="bg-secondary rounded-md p-4 mb-3">{d?.entries?.length ? <DocCard entries={d.entries} /> : <p className="text-muted">尚無資料</p>}</div>; })()}
            <div className="bg-secondary rounded-md p-4 mb-3">{tripDrivingStats ? <TripDrivingStatsCard tripStats={tripDrivingStats} /> : <p>無交通資料</p>}</div>
          </>
        );
      /* Settings sheets */
      case 'trip-select':
        return (
          <div className="max-w-[520px] mx-auto p-padding-h">
            <div className="mb-3">
              <div className="flex flex-col gap-2">
                {sheetTripsLoading && (
                  <div className={LOADING_CLASS}>載入中...</div>
                )}
                {!sheetTripsLoading && sheetTrips.map((t) => (
                  <button
                    key={t.tripId}
                    className={clsx('trip-btn', t.tripId === activeTripId && 'active')}
                    onClick={() => onTripChange(t.tripId)}
                  >
                    <strong className="block text-title3">{t.name}</strong>
                    {t.title && <span className="text-caption text-muted mt-1 block">{t.title}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 'appearance':
        return (
          <div className="max-w-[520px] mx-auto p-padding-h">
            <div className="mb-3">
              <div className="text-footnote font-semibold text-muted uppercase tracking-wider mb-3 pb-2 border-b border-border">色彩模式</div>
              <div className="grid grid-cols-3 gap-3">
                {COLOR_MODE_OPTIONS.map((m) => (
                  <button
                    key={m.key}
                    className={clsx('color-mode-card', m.key === colorMode && 'active')}
                    onClick={() => setColorMode(m.key)}
                  >
                    <div className={`color-mode-preview color-mode-${m.key}`}>
                      <div className="cmp-top"></div>
                      <div className="cmp-bottom">
                        <div className="cmp-input"></div>
                        <div className="cmp-dot"></div>
                      </div>
                    </div>
                    <div className="text-caption text-muted mt-1">{m.label}</div>
                  </button>
                ))}
              </div>
              <div className="text-caption font-semibold text-muted mt-4 mb-2">色彩主題</div>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_THEMES.map((t) => (
                  <button
                    key={t.key}
                    className={clsx('color-theme-card', t.key === colorTheme && 'active')}
                    data-theme={t.key}
                    onClick={() => setTheme(t.key)}
                  >
                    <div
                      className="color-theme-swatch"
                      style={isDark ? SWATCH_STYLES[t.key]?.dark : SWATCH_STYLES[t.key]?.light}
                    />
                    <div className="text-caption text-muted mt-1">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  }, [activeSheet, docs, tripDrivingStats, currentDay, sheetTrips, sheetTripsLoading, activeTripId, onTripChange, colorMode, setColorMode, colorTheme, setTheme, isDark]);

  return <>{content}</>;
}
