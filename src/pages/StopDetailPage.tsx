/**
 * StopDetailPage — /trip/:tripId/stop/:entryId
 *
 * Single-stop detail page with Ocean map (detail mode) + full info.
 * Consumes shared trip data from <TripLayout> via useTripContext.
 *
 *  ┌───────────────────────────────────────────┐
 *  │ ← 返回    {stop title}          (mode 🗺)  │  sticky topbar
 *  ├───────────────────────────────────────────┤
 *  │                                           │
 *  │          OceanMap (mode=detail)           │  280px
 *  │                                           │
 *  ├───────────────────────────────────────────┤
 *  │ DAY 02 · 7/27 · 14:30–15:30               │
 *  │ 東橫INN 沖繩那霸國際通美榮橋站             │  title
 *  │ Toyoko Inn Okinawa Naha Kokusai-dori...   │
 *  │ ────                                      │
 *  │ 📍 1-20-1 Makishi                          │
 *  │ 💬 <note>                                  │
 *  │ [infoBoxes — restaurants / parking / …]   │
 *  ├───────────────────────────────────────────┤
 *  │ [ 在 Google Maps 開啟導航 ]               │  action button
 *  └───────────────────────────────────────────┘
 */

import { lazy, Suspense, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useTripContext } from '../contexts/TripContext';
import { useScrollRestoreOnBack } from '../hooks/useScrollRestoreOnBack';
import { extractPinsFromDay } from '../hooks/useMapData';
import { toTimelineEntry } from '../lib/mapDay';
import { EXTERNAL_NAVIGATION_URL_BASE } from '../lib/constants';
import { NavLinks } from '../components/trip/MapLinks';
import InfoBox from '../components/trip/InfoBox';
import MarkdownText from '../components/shared/MarkdownText';
import Icon from '../components/shared/Icon';
import TriplineLogo from '../components/shared/TriplineLogo';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { Day, Entry } from '../types/trip';

const OceanMap = lazy(() => import('../components/trip/OceanMap'));

/* ===== Scoped styles ===== */
const SCOPED_STYLES = `
.stop-detail-wrap {
  min-height: 100dvh;
  background: var(--color-background);
  padding-bottom: calc(96px + env(safe-area-inset-bottom));
}
.stop-detail-topbar {
  position: sticky; top: 0; z-index: var(--z-sticky-nav);
  background: var(--color-glass-nav);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--color-border);
  padding: 10px 16px; display: flex; align-items: center; gap: 12px;
  height: 52px;
}
.stop-detail-back {
  width: 36px; height: 36px; border-radius: 50%;
  display: grid; place-items: center;
  background: transparent; border: none; cursor: pointer;
  color: var(--color-foreground);
  transition: background-color var(--transition-duration-fast) var(--transition-timing-function-apple);
}
.stop-detail-back:hover { background: var(--color-hover); }
.stop-detail-topbar-title {
  flex: 1; min-width: 0;
  font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--color-foreground);
}
.stop-detail-map { margin: 0 0 16px; }
.stop-detail-body { max-width: 720px; margin: 0 auto; padding: 0 16px; }
.stop-detail-meta {
  font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted); margin: 16px 0 6px;
  display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
}
.stop-detail-meta-sep { opacity: 0.5; }
.stop-detail-title {
  font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--color-foreground); line-height: 1.25; margin: 0 0 4px;
}
.stop-detail-subtitle { font-size: 13px; color: var(--color-muted); margin: 0 0 16px; }
.stop-detail-section {
  padding: 14px 0; border-top: 1px solid var(--color-border);
}
.stop-detail-section:first-of-type { border-top: none; }
.stop-detail-section h3 {
  font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted); margin: 0 0 8px;
}
.stop-detail-note { font-size: 15px; line-height: 1.6; color: var(--color-foreground); }
.stop-detail-action {
  position: fixed; left: 16px; right: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom));
  max-width: 720px; margin: 0 auto;
  padding: 14px 20px; border-radius: 999px;
  background: var(--color-accent); color: #fff;
  font-size: 15px; font-weight: 600; letter-spacing: 0.01em;
  text-align: center; text-decoration: none;
  box-shadow: 0 6px 20px rgba(0, 119, 182, 0.35);
  display: flex; align-items: center; justify-content: center; gap: 8px;
  z-index: calc(var(--z-sticky-nav) - 1);
}
.stop-detail-action:active { transform: scale(0.98); }
.stop-detail-empty {
  padding: 48px 16px; text-align: center; color: var(--color-muted);
}
.stop-detail-skeleton {
  height: 280px; margin: 0 0 16px;
  background: var(--color-secondary);
  animation: stopDetailPulse 1.5s ease-in-out infinite;
}
@keyframes stopDetailPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
@media (min-width: 961px) {
  .stop-detail-body { padding: 0 32px; }
}
`;

/* ===== Entry lookup ===== */

interface EntryContext {
  entry: Entry;
  dayNum: number;
  date: string | null;
  dayLabel: string | null;
}

function findEntryInDays(allDays: Record<number, Day>, entryId: number): EntryContext | null {
  for (const dayNum of Object.keys(allDays).map((n) => Number(n))) {
    const day = allDays[dayNum];
    if (!day?.timeline) continue;
    const entry = day.timeline.find((e) => e.id === entryId);
    if (entry) {
      return { entry, dayNum, date: day.date ?? null, dayLabel: day.label ?? null };
    }
  }
  return null;
}

function formatDateLabel(date: string | null): string {
  if (!date) return '';
  const d = new Date(date + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ===== Component ===== */

export default function StopDetailPage() {
  const { entryId: entryIdStr } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  useScrollRestoreOnBack();

  const entryId = Number(entryIdStr);
  const { trip, allDays, loading } = useTripContext();

  const entryCtx = useMemo(
    () => (Number.isFinite(entryId) && allDays ? findEntryInDays(allDays, entryId) : null),
    [allDays, entryId],
  );

  const timelineEntry = useMemo(
    () => (entryCtx ? toTimelineEntry(entryCtx.entry) : null),
    [entryCtx],
  );

  // Single-pin detail mode: filter pins to just this entry
  const detailPins = useMemo(() => {
    if (!entryCtx) return [];
    const day = allDays[entryCtx.dayNum];
    if (!day) return [];
    const { pins } = extractPinsFromDay(day);
    return pins.filter((p) => p.type === 'entry' && p.id === entryId);
  }, [entryCtx, allDays, entryId]);

  /* --- Loading state (trip still fetching) --- */
  if (loading) {
    return (
      <div className="stop-detail-wrap">
        <style>{SCOPED_STYLES}</style>
        <StopDetailTopbar onBack={() => navigate(-1)} title="" />
        <div className="stop-detail-skeleton" />
        <div className="stop-detail-body">
          <div className="h-4 w-24 bg-secondary rounded animate-pulse my-4" />
          <div className="h-8 w-3/4 bg-secondary rounded animate-pulse my-2" />
          <div className="h-4 w-1/2 bg-secondary rounded animate-pulse" />
        </div>
      </div>
    );
  }

  /* --- 404: entry not found --- */
  if (!entryCtx || !timelineEntry) {
    return (
      <div className="stop-detail-wrap">
        <style>{SCOPED_STYLES}</style>
        <StopDetailTopbar onBack={() => navigate(-1)} title="" />
        <div className="stop-detail-empty">
          <TriplineLogo isOnline={isOnline} />
          <p className="mt-4 text-lg font-semibold text-foreground">找不到這個景點</p>
          <p className="mt-2 text-sm">景點可能已被刪除或連結過期</p>
          <button
            type="button"
            className="mt-6 px-5 py-2 rounded-full bg-accent text-white font-semibold"
            onClick={() => navigate(-1)}
          >
            返回行程
          </button>
        </div>
      </div>
    );
  }

  const { entry, dayNum, date } = entryCtx;
  const dateLabel = formatDateLabel(date);
  const time = entry.time ?? '';
  const title = entry.title ?? '';
  const description = entry.description ?? '';
  const note = timelineEntry.note ?? '';
  const locations = timelineEntry.locations ?? [];
  const infoBoxes = timelineEntry.infoBoxes ?? [];
  const primaryLoc = locations[0];

  /* --- External nav URL (open in Google Maps app) --- */
  // Prefer the pin's lat/lng (from extractPinsFromDay) for precise coords,
  // fall back to googleQuery text search otherwise.
  const externalMapUrl = (() => {
    const pin = detailPins[0];
    if (pin) {
      return `${EXTERNAL_NAVIGATION_URL_BASE}?api=1&query=${pin.lat},${pin.lng}`;
    }
    if (primaryLoc?.googleQuery) {
      return `${EXTERNAL_NAVIGATION_URL_BASE}?api=1&query=${encodeURIComponent(primaryLoc.googleQuery)}`;
    }
    return null;
  })();

  return (
    <div className="stop-detail-wrap">
      <style>{SCOPED_STYLES}</style>
      <StopDetailTopbar onBack={() => navigate(-1)} title={title} />

      {detailPins.length > 0 ? (
        <div className="stop-detail-map">
          <Suspense fallback={<div className="stop-detail-skeleton" />}>
            <OceanMap pins={detailPins} mode="detail" routes={false} />
          </Suspense>
        </div>
      ) : (
        <div className="stop-detail-map">
          <div className="stop-detail-skeleton flex items-center justify-center text-muted text-sm">
            無位置資訊
          </div>
        </div>
      )}

      <div className="stop-detail-body">
        <div className="stop-detail-meta">
          <span>DAY {String(dayNum).padStart(2, '0')}</span>
          {dateLabel && <><span className="stop-detail-meta-sep">·</span><span>{dateLabel}</span></>}
          {time && <><span className="stop-detail-meta-sep">·</span><span>{time}</span></>}
        </div>
        <h1 className="stop-detail-title">{title || '（無標題）'}</h1>
        {description && <p className="stop-detail-subtitle">{description}</p>}

        {note && (
          <div className="stop-detail-section">
            <h3>備註</h3>
            <MarkdownText text={note} as="div" className="stop-detail-note" />
          </div>
        )}

        {locations.length > 0 && (
          <div className="stop-detail-section">
            <h3>地址 · 導航</h3>
            <NavLinks locations={locations} />
          </div>
        )}

        {infoBoxes.length > 0 && (
          <div className="stop-detail-section">
            <h3>相關資訊</h3>
            {infoBoxes.map((box, i) => <InfoBox key={i} box={box} />)}
          </div>
        )}

        {trip?.title && (
          <div className="stop-detail-section text-sm text-muted">
            <span>來自行程：</span>
            <a
              href={`/trip/${trip.id}`}
              className={clsx('text-accent font-medium ml-1')}
              onClick={(e) => { e.preventDefault(); navigate(`/trip/${trip.id}`); }}
            >
              {trip.title}
            </a>
          </div>
        )}
      </div>

      {externalMapUrl && (
        <a
          className="stop-detail-action"
          href={externalMapUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="在 Google Maps 開啟導航"
        >
          <Icon name="location-pin" />
          <span>在 Google Maps 開啟導航</span>
        </a>
      )}
    </div>
  );
}

/* ===== Subcomponent: Topbar ===== */

interface TopbarProps {
  onBack: () => void;
  title: string;
}

function StopDetailTopbar({ onBack, title }: TopbarProps) {
  return (
    <header className="stop-detail-topbar">
      <button
        type="button"
        className="stop-detail-back"
        onClick={onBack}
        aria-label="返回行程"
      >
        <Icon name="chevron-left" />
      </button>
      <span className="stop-detail-topbar-title">{title}</span>
    </header>
  );
}
