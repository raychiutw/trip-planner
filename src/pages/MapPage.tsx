/**
 * MapPage — fullscreen map view, shared by 3 routes:
 *
 *  /trip/:tripId/map                      → all trip pins, overview mode
 *  /trip/:tripId/map?day=N                → single day's pins, overview mode
 *  /trip/:tripId/stop/:entryId/map        → single entry, detail mode
 *
 *  ┌────────────────────────────────────────────┐
 *  │ ← 返回   DAY 01 · 7/29 · 北谷             │  52px topbar
 *  ├────────────────────────────────────────────┤
 *  │                                            │
 *  │          OceanMap (fullscreen)             │  100dvh - 52
 *  │                                            │
 *  └────────────────────────────────────────────┘
 */

import { lazy, Suspense, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTripContext } from '../contexts/TripContext';
import { extractPinsFromDay } from '../hooks/useMapData';
import Icon from '../components/shared/Icon';
import TriplineLogo from '../components/shared/TriplineLogo';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { Day, Entry } from '../types/trip';

const OceanMap = lazy(() => import('../components/trip/OceanMap'));

const SCOPED_STYLES = `
.map-page-wrap {
  height: 100dvh;
  display: flex; flex-direction: column;
  background: var(--color-background);
  overflow: hidden;
}
.map-page-topbar {
  flex-shrink: 0;
  background: var(--color-glass-nav);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--color-border);
  padding: 10px 16px;
  display: flex; align-items: center; gap: 12px;
  height: 52px;
}
.map-page-back {
  width: 36px; height: 36px; border-radius: 50%;
  display: grid; place-items: center; flex-shrink: 0;
  background: transparent; border: none; cursor: pointer;
  color: var(--color-foreground);
  transition: background-color 160ms var(--transition-timing-function-apple),
              color 160ms var(--transition-timing-function-apple);
}
.map-page-back:hover { background: var(--color-hover); color: var(--color-accent); }

.map-page-crumb {
  flex: 1; min-width: 0;
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--color-muted);
  white-space: nowrap; overflow: hidden;
}
.map-page-crumb-day { color: var(--color-foreground); }
.map-page-crumb-sep { opacity: 0.4; }
.map-page-crumb > span { white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }

.map-page-body {
  flex: 1;
  position: relative;
  min-height: 0;
}
.map-page-body > * { width: 100%; height: 100%; }
/* Override OceanMap's hardcoded heights (420px/280px) — we want fullscreen */
.map-page-body .ocean-map-container,
.map-page-body .ocean-map-container[data-mode="detail"],
.map-page-body .ocean-map-container[data-mode="overview"] {
  height: 100% !important;
  min-height: 0;
  border-radius: 0;
}
.map-page-empty {
  height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--color-muted); gap: 8px;
  padding: 24px;
}

@media (max-width: 760px) {
  .map-page-crumb { font-size: 10px; letter-spacing: 0.12em; }
}
`;

interface EntryContext {
  entry: Entry;
  dayNum: number;
  date: string | null;
}

function findEntryInDays(allDays: Record<number, Day>, entryId: number): EntryContext | null {
  for (const dayNum of Object.keys(allDays).map((n) => Number(n))) {
    const day = allDays[dayNum];
    if (!day?.timeline) continue;
    const entry = day.timeline.find((e) => e.id === entryId);
    if (entry) return { entry, dayNum, date: day.date ?? null };
  }
  return null;
}

function formatDateLabel(date: string | null): string {
  if (!date) return '';
  const d = new Date(date + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function MapPage() {
  const { tripId, entryId: entryIdStr } = useParams<{ tripId: string; entryId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { trip, allDays, loading } = useTripContext();

  const entryId = entryIdStr ? Number(entryIdStr) : null;
  const dayQueryParam = searchParams.get('day');
  const dayFilter = dayQueryParam ? Number(dayQueryParam) : null;

  /* --- Determine mode + pins + breadcrumb --- */

  const { pins, focusId, mode, crumb } = useMemo(() => {
    if (!allDays) return { pins: [], focusId: undefined, mode: 'overview' as const, crumb: '' };

    // Detail mode: single entry focus
    if (entryId != null && Number.isFinite(entryId)) {
      const ctx = findEntryInDays(allDays, entryId);
      if (!ctx) return { pins: [], focusId: undefined, mode: 'detail' as const, crumb: '' };
      const dayPins = extractPinsFromDay(allDays[ctx.dayNum]!).pins;
      const entryPin = dayPins.find((p) => p.type === 'entry' && p.id === entryId);
      return {
        pins: entryPin ? [entryPin] : [],
        focusId: entryPin ? entryId : undefined,
        mode: 'detail' as const,
        crumb: `DAY ${String(ctx.dayNum).padStart(2, '0')} · ${formatDateLabel(ctx.date)} · ${ctx.entry.title ?? ''}`,
      };
    }

    // Per-day overview
    if (dayFilter != null && Number.isFinite(dayFilter) && allDays[dayFilter]) {
      const day = allDays[dayFilter]!;
      const dayPins = extractPinsFromDay(day).pins;
      return {
        pins: dayPins,
        focusId: undefined,
        mode: 'overview' as const,
        crumb: `DAY ${String(dayFilter).padStart(2, '0')} · ${formatDateLabel(day.date ?? null)}${day.label ? ` · ${day.label}` : ''}`,
      };
    }

    // Full trip overview
    const dayNums = Object.keys(allDays).map((n) => Number(n)).sort((a, b) => a - b);
    const allPins = dayNums.flatMap((n) => extractPinsFromDay(allDays[n]!).pins);
    return {
      pins: allPins,
      focusId: undefined,
      mode: 'overview' as const,
      crumb: `全行程 · ${trip?.title ?? ''}`,
    };
  }, [allDays, entryId, dayFilter, trip?.title]);

  /* --- Back navigation --- */
  const onBack = () => {
    if (entryId != null) navigate(`/trip/${tripId}/stop/${entryId}`);
    else navigate(`/trip/${tripId}`);
  };

  return (
    <div className="map-page-wrap">
      <style>{SCOPED_STYLES}</style>

      <header className="map-page-topbar">
        <button
          type="button"
          className="map-page-back"
          onClick={onBack}
          aria-label="返回"
        >
          <Icon name="chevron-left" />
        </button>
        <div className="map-page-crumb">
          {crumb.split(' · ').map((part, i) => (
            <span key={i}>
              {i > 0 && <span className="map-page-crumb-sep" aria-hidden="true">·</span>}
              <span className={i === 0 ? 'map-page-crumb-day' : ''}>{part}</span>
            </span>
          ))}
        </div>
        <TriplineLogo isOnline={isOnline} />
      </header>

      <main className="map-page-body">
        {loading ? (
          <div className="map-page-empty">
            <span>載入中…</span>
          </div>
        ) : pins.length === 0 ? (
          <div className="map-page-empty">
            <span>沒有位置資訊</span>
          </div>
        ) : (
          <Suspense fallback={<div className="map-page-empty"><span>地圖載入中…</span></div>}>
            <OceanMap pins={pins} mode={mode} focusId={focusId} routes={mode === 'overview'} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
