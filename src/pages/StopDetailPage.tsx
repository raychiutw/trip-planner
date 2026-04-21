/**
 * StopDetailPage — /trip/:tripId/stop/:entryId
 *
 * Single-stop detail page with Ocean map (detail mode) + full info.
 * Consumes shared trip data from <TripLayout> via useTripContext.
 *
 *  ┌───────────────────────────────────────────┐
 *  │ ← 返回  DAY 02 · 7/27 · 14:30      {trip} │  sticky topbar (breadcrumb)
 *  ├───────────────────────────────────────────┤
 *  │ 東橫INN 沖繩那霸國際通美榮橋站             │  hero title
 *  │ Toyoko Inn Okinawa Naha Kokusai-dori...   │  hero subtitle
 *  │                                           │
 *  │    ┌─────────────────────────────┐        │
 *  │    │  OceanMap (rounded, shadow) │        │
 *  │    └─────────────────────────────┘        │
 *  │                                           │
 *  │ 備註 ....................................│
 *  │ 地址 · 導航 .............................│
 *  │ 相關資訊（正 + 備選 + 必買購物）         │
 *  ├───────────────────────────────────────────┤
 *  │ [ 在 Google Maps 開啟導航 ]  ← mobile sticky│
 *  └───────────────────────────────────────────┘
 */

import { lazy, Suspense, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTripContext } from '../contexts/TripContext';
import { useScrollRestoreOnBack } from '../hooks/useScrollRestoreOnBack';
import { extractPinsFromDay } from '../hooks/useMapData';
import { toTimelineEntry, findEntryInDays, formatDateLabel } from '../lib/mapDay';
import { EXTERNAL_NAVIGATION_URL_BASE } from '../lib/constants';
import { NavLinks } from '../components/trip/MapLinks';
import InfoBox from '../components/trip/InfoBox';
import MarkdownText from '../components/shared/MarkdownText';
import Icon from '../components/shared/Icon';
import TriplineLogo from '../components/shared/TriplineLogo';
import BreadcrumbCrumbs from '../components/shared/BreadcrumbCrumbs';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const OceanMap = lazy(() => import('../components/trip/OceanMap'));

/* ===== Scoped styles ===== */
const SCOPED_STYLES = `
.stop-detail-wrap {
  min-height: 100dvh;
  background: var(--color-background);
  padding-bottom: calc(96px + env(safe-area-inset-bottom));
}
@media (min-width: 961px) {
  .stop-detail-wrap { padding-bottom: 48px; }
}

/* --- Topbar (breadcrumb style) --- */
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
  display: grid; place-items: center; flex-shrink: 0;
  background: transparent; border: none; cursor: pointer;
  color: var(--color-foreground);
  transition: background-color 160ms var(--transition-timing-function-apple),
              color 160ms var(--transition-timing-function-apple);
}
.stop-detail-back:hover { background: var(--color-hover); color: var(--color-accent); }
.stop-detail-crumb {
  flex: 1; min-width: 0;
  display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;
  font-size: var(--font-size-caption2); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--color-muted);
  overflow: hidden; white-space: nowrap;
}
.stop-detail-crumb > span { white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
.stop-detail-crumb-day { color: var(--color-foreground); }
.stop-detail-crumb-sep { opacity: 0.4; }
.stop-detail-crumb-trip {
  margin-left: auto;
  color: var(--color-muted);
  letter-spacing: normal; text-transform: none; font-weight: 500; font-size: 12px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  text-decoration: none;
  max-width: 48%;
  display: none;
}
@media (min-width: 768px) {
  .stop-detail-crumb-trip { display: inline-block; }
}
.stop-detail-crumb-trip:hover { color: var(--color-accent); text-decoration: underline; }

/* --- Hero (title + subtitle + map) --- */
.stop-detail-body { max-width: 720px; margin: 0 auto; padding: 0 16px; }
@media (min-width: 961px) {
  .stop-detail-body { padding: 0 32px; }
}
.stop-detail-hero { padding: 20px 0 4px; }
.stop-detail-title {
  font-size: 26px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--color-foreground); line-height: 1.2; margin: 0 0 4px;
}
@media (min-width: 768px) {
  .stop-detail-title { font-size: 30px; }
}
.stop-detail-subtitle {
  font-size: 15px; color: var(--color-muted); margin: 0;
  line-height: 1.5;
}

/* --- Map wrapper (rounded card, constrained width) --- */
.stop-detail-map {
  max-width: 720px; margin: 16px auto;
  padding: 0 16px;
}
@media (min-width: 961px) {
  .stop-detail-map { padding: 0 32px; }
}
.stop-detail-map-inner {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06);
  border: 1px solid var(--color-border);
  aspect-ratio: 16 / 9;
  max-height: 320px;
  background: var(--color-secondary);
  position: relative;
}
.stop-detail-map-expand {
  position: absolute; top: 10px; right: 10px; z-index: 400;
  width: 36px; height: 36px; border-radius: 10px;
  display: grid; place-items: center;
  background: var(--color-background); border: 1px solid var(--color-border);
  color: var(--color-foreground); cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  text-decoration: none;
  transition: border-color 160ms var(--transition-timing-function-apple),
              color 160ms var(--transition-timing-function-apple);
}
.stop-detail-map-expand:hover { border-color: var(--color-accent); color: var(--color-accent); }
.stop-detail-map-inner > *:not(.stop-detail-map-expand) { width: 100%; height: 100%; }

/* --- Body sections --- */
.stop-detail-section {
  padding: 20px 0 4px;
  border-top: 1px solid var(--color-border);
  margin-top: 16px;
}
.stop-detail-section:first-of-type { border-top: none; margin-top: 8px; }
.stop-detail-section h3 {
  font-size: var(--font-size-caption2); font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted); margin: 0 0 10px;
}
.stop-detail-note {
  font-size: 16px; line-height: 1.65; color: var(--color-foreground);
}

/* --- Action button (mobile sticky / desktop inline) --- */
.stop-detail-action-wrap {
  position: fixed; left: 16px; right: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: calc(var(--z-sticky-nav) - 1);
  display: flex; justify-content: center;
}
@media (min-width: 961px) {
  .stop-detail-action-wrap {
    position: static; left: auto; right: auto; bottom: auto;
    margin: 24px auto 8px; padding: 0 32px;
    max-width: 720px; width: 100%; box-sizing: border-box;
  }
}
.stop-detail-action {
  width: 100%; max-width: 720px;
  padding: 14px 20px; border-radius: 999px;
  background: var(--color-accent); color: #fff;
  font-size: 15px; font-weight: 600; letter-spacing: 0.01em;
  text-align: center; text-decoration: none;
  box-shadow: 0 1px 3px rgba(0,119,182,0.18), 0 4px 14px rgba(0,119,182,0.2);
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: transform 140ms var(--transition-timing-function-apple),
              box-shadow 140ms var(--transition-timing-function-apple);
}
.stop-detail-action:hover { box-shadow: 0 2px 4px rgba(0,119,182,0.22), 0 6px 18px rgba(0,119,182,0.26); }
.stop-detail-action:active { transform: scale(0.98); }

/* --- Empty state --- */
.stop-detail-empty {
  padding: 48px 16px; text-align: center; color: var(--color-muted);
}
.stop-detail-skeleton {
  width: 100%; height: 100%;
  background: var(--color-secondary);
  animation: stopDetailPulse 1.5s ease-in-out infinite;
}
@keyframes stopDetailPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }

/* --- Print mode: hide map + action + topbar chrome --- */
body.print-mode .stop-detail-map,
body.print-mode .stop-detail-action-wrap,
body.print-mode .stop-detail-back { display: none !important; }
body.print-mode .stop-detail-topbar { position: static; }
`;

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
        <StopDetailTopbar onBack={() => navigate(-1)} crumb={null} tripTitle={null} tripId={null} navigate={navigate} isOnline={isOnline} />
        <div className="stop-detail-body">
          <div className="stop-detail-hero">
            <div className="h-7 w-3/4 bg-secondary rounded animate-pulse mb-2" />
            <div className="h-4 w-1/2 bg-secondary rounded animate-pulse" />
          </div>
        </div>
        <div className="stop-detail-map">
          <div className="stop-detail-map-inner"><div className="stop-detail-skeleton" /></div>
        </div>
      </div>
    );
  }

  /* --- 404: entry not found --- */
  if (!entryCtx || !timelineEntry) {
    return (
      <div className="stop-detail-wrap">
        <style>{SCOPED_STYLES}</style>
        <StopDetailTopbar onBack={() => navigate(-1)} crumb={null} tripTitle={null} tripId={null} navigate={navigate} isOnline={isOnline} />
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

  const crumbParts: string[] = [];
  crumbParts.push(`DAY ${String(dayNum).padStart(2, '0')}`);
  if (dateLabel) crumbParts.push(dateLabel);
  if (time) crumbParts.push(time);
  const crumb = crumbParts.join(' · ');

  return (
    <div className="stop-detail-wrap">
      <style>{SCOPED_STYLES}</style>
      <StopDetailTopbar
        onBack={() => navigate(-1)}
        crumb={crumb}
        tripTitle={trip?.title ?? null}
        tripId={trip?.id ?? null}
        navigate={navigate}
        isOnline={isOnline}
      />

      <div className="stop-detail-body">
        <div className="stop-detail-hero">
          <h1 className="stop-detail-title">{title || '（無標題）'}</h1>
          {description && <p className="stop-detail-subtitle">{description}</p>}
        </div>
      </div>

      {detailPins.length > 0 ? (
        <div className="stop-detail-map">
          <div className="stop-detail-map-inner">
            <Suspense fallback={<div className="stop-detail-skeleton" />}>
              <OceanMap pins={detailPins} mode="detail" routes={false} />
            </Suspense>
            <a
              className="stop-detail-map-expand"
              href={`/trip/${trip?.id}/stop/${entryId}/map`}
              onClick={(e) => { e.preventDefault(); navigate(`/trip/${trip?.id}/stop/${entryId}/map`); }}
              aria-label="地圖全螢幕"
              title="地圖全螢幕"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </a>
          </div>
        </div>
      ) : (
        <div className="stop-detail-map">
          <div className="stop-detail-map-inner flex items-center justify-center text-muted text-sm">
            無位置資訊
          </div>
        </div>
      )}

      <div className="stop-detail-body">
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
      </div>

      {externalMapUrl && (
        <div className="stop-detail-action-wrap">
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
        </div>
      )}
    </div>
  );
}

/* ===== Subcomponent: Topbar (breadcrumb style) ===== */

interface TopbarProps {
  onBack: () => void;
  crumb: string | null;
  tripTitle: string | null;
  tripId: string | null;
  navigate: ReturnType<typeof useNavigate>;
  isOnline: boolean;
}

function StopDetailTopbar({ onBack, crumb, tripTitle, tripId, navigate, isOnline }: TopbarProps) {
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
      <div className="stop-detail-crumb">
        {crumb && <BreadcrumbCrumbs parts={crumb.split(' · ')} classPrefix="stop-detail-crumb" />}
        {tripTitle && tripId && (
          <a
            className="stop-detail-crumb-trip ml-auto"
            href={`/trip/${tripId}`}
            onClick={(e) => { e.preventDefault(); navigate(`/trip/${tripId}`); }}
            aria-label={`返回行程 ${tripTitle}`}
          >
            {tripTitle}
          </a>
        )}
      </div>
      <TriplineLogo isOnline={isOnline} />
    </header>
  );
}
