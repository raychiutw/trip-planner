/**
 * TripSheetContent — renders the active sheet's content based on `activeSheet`.
 * Extracted from TripPage.tsx to reduce file size.
 */

import { useMemo } from 'react';
import clsx from 'clsx';
import DocCard from './DocCard';
import FlightSheet from './FlightSheet';
import SuggestionSheet from './SuggestionSheet';
import TodayRouteSheet from './TodayRouteSheet';
import CollabSheet from './CollabSheet';
import Icon from '../shared/Icon';
import { toTimelineEntry } from '../../lib/mapDay';
import { COLOR_MODE_OPTIONS } from '../../lib/appearance';
import type { Day, TripListItem } from '../../types/trip';
import type { DocEntry } from './DocCard';
import type { ColorMode } from '../../hooks/useDarkMode';

/* ===== Sheet content config ===== */

export const SHEET_TITLES: Record<string, string> = {
  flights: '航班資訊',
  checklist: '出發前確認',
  backup: '備案',
  emergency: '緊急聯絡',
  suggestions: 'AI 建議',
  'today-route': '今日路線',
  'trip-select': '切換行程',
  appearance: '外觀設定',
  collab: '共編設定',
  'action-menu': '更多功能',
};

const LOADING_CLASS = 'text-center p-10 text-muted';

/* ===== Props ===== */

interface TripSheetContentProps {
  activeSheet: string | null;
  docs: Record<string, unknown>;
  currentDay: Day | null;
  sheetTrips: TripListItem[];
  sheetTripsLoading: boolean;
  activeTripId: string | null;
  onTripChange: (tripId: string) => void;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  /** Open a different sheet from within current sheet (used by action-menu grid). */
  onOpenSheet?: (key: string) => void;
  /** Trigger print mode (used by action-menu). */
  onPrint?: () => void;
  /** Trigger a download by format (used by action-menu export row). */
  onDownload?: (format: string) => void;
  /** Online status for gating write actions. */
  isOnline?: boolean;
}

/** Items rendered in the action-menu sheet's 2-column grid (4 rows × 2 cols). */
const ACTION_MENU_GRID: { key: string; icon: string; label: string; requiresOnline?: boolean }[] = [
  { key: 'flights',      icon: 'plane',        label: '航班' },
  { key: 'today-route',  icon: 'route',        label: '路線' },
  { key: 'checklist',    icon: 'check-circle', label: '清單' },
  { key: 'emergency',    icon: 'emergency',    label: '緊急' },
  { key: 'backup',       icon: 'backup',       label: '備案' },
  { key: 'suggestions',  icon: 'lightbulb',    label: 'AI 建議' },
  { key: 'collab',       icon: 'group',        label: '共編', requiresOnline: true },
  { key: 'trip-select',  icon: 'swap-horiz',   label: '切換行程', requiresOnline: true },
  { key: 'appearance',   icon: 'palette',      label: '外觀' },
];

const ACTION_MENU_EXPORTS: { key: string; icon: string; label: string; action: 'print' | 'download' }[] = [
  { key: 'printer',       icon: 'printer',  label: '列印',   action: 'print' },
  { key: 'download-pdf',  icon: 'download', label: 'PDF',    action: 'download' },
  { key: 'download-md',   icon: 'doc',      label: 'MD',     action: 'download' },
  { key: 'download-json', icon: 'code',     label: 'JSON',   action: 'download' },
  { key: 'download-csv',  icon: 'table',    label: 'CSV',    action: 'download' },
];

/* ===== Component ===== */

export default function TripSheetContent({
  activeSheet,
  docs,
  currentDay,
  sheetTrips,
  sheetTripsLoading,
  activeTripId,
  onTripChange,
  colorMode,
  setColorMode,
  onOpenSheet,
  onPrint,
  onDownload,
  isOnline = true,
}: TripSheetContentProps) {
  const content = useMemo(() => {
    if (!activeSheet) return null;
    switch (activeSheet) {
      /* Flight — rich card (mockup 對齊) */
      case 'flights': {
        const docData = docs.flights as { title?: string; entries?: DocEntry[] } | undefined;
        return docData?.entries?.length
          ? <FlightSheet entries={docData.entries} />
          : <p className="text-callout text-muted text-center py-4">尚無航班資料</p>;
      }
      /* Suggestions — 3-tier priority (mockup 對齊) */
      case 'suggestions': {
        const docData = docs.suggestions as { title?: string; entries?: DocEntry[] } | undefined;
        return docData?.entries?.length
          ? <SuggestionSheet entries={docData.entries} />
          : <p className="text-callout text-muted text-center py-4">尚無建議</p>;
      }
      /* Generic doc sheets */
      case 'checklist':
      case 'backup':
      case 'emergency': {
        const docData = docs[activeSheet] as { title?: string; entries?: DocEntry[] } | undefined;
        return docData?.entries?.length
          ? <DocCard entries={docData.entries} />
          : <p className="text-callout text-muted text-center py-4">尚無資料</p>;
      }
      case 'today-route':
        return currentDay && currentDay.timeline.length > 0
          ? <TodayRouteSheet events={currentDay.timeline.map((e) => typeof e === 'object' && e !== null ? toTimelineEntry(e) : toTimelineEntry({}))} />
          : <p>無行程資料</p>;
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
      case 'collab':
        return <CollabSheet tripId={activeTripId ?? ''} />;
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
            </div>
          </div>
        );
      case 'action-menu':
        return (
          <div className="max-w-[520px] mx-auto p-padding-h">
            <div className="grid grid-cols-2 gap-2 mb-4">
              {ACTION_MENU_GRID.map((g) => {
                const disabled = !!g.requiresOnline && !isOnline;
                return (
                  <button
                    key={g.key}
                    type="button"
                    className={clsx(
                      'flex flex-col items-center justify-center gap-2 py-4 rounded-md border border-border bg-background cursor-pointer font-inherit text-foreground transition-colors duration-fast ease-apple',
                      !disabled && 'hover:border-accent',
                      disabled && 'opacity-40 cursor-not-allowed',
                    )}
                    disabled={disabled}
                    onClick={() => onOpenSheet?.(g.key)}
                  >
                    <Icon name={g.icon} />
                    <span className="text-caption font-semibold">{g.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="text-caption2 font-semibold tracking-[0.18em] uppercase text-muted mb-2">Export</div>
            <div className="flex flex-col gap-1.5">
              {ACTION_MENU_EXPORTS.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-sm border border-border bg-background cursor-pointer font-inherit text-foreground hover:border-accent transition-colors duration-fast ease-apple"
                  onClick={() => {
                    if (e.action === 'print') onPrint?.();
                    else onDownload?.(e.key.replace('download-', ''));
                  }}
                >
                  <Icon name={e.icon} />
                  <span className="flex-1 text-callout text-left">{e.label}</span>
                  <Icon name="chevronR" />
                </button>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  }, [activeSheet, docs, currentDay, sheetTrips, sheetTripsLoading, activeTripId, onTripChange, colorMode, setColorMode, onOpenSheet, onPrint, onDownload, isOnline]);

  return <>{content}</>;
}
