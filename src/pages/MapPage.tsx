/**
 * MapPage — fullscreen map view (Funliday-style navigation).
 *
 *  /trip/:tripId/map                  → day 1 by default
 *  /trip/:tripId/map?day=N            → specific day
 *  /trip/:tripId/map?day=all          → overview (all days, per-day dayColor polyline)
 *  /trip/:tripId/stop/:entryId/map    → focus that entry (auto-detects day)
 *
 *  ┌────────────────────────────────────────────┐
 *  │ ← 返回   總覽 · 7/29 – 8/4  |  DAY NN ...  │  52px topbar
 *  ├────────────────────────────────────────────┤
 *  │                                            │
 *  │          OceanMap (flyTo activeEntry       │  flex-1
 *  │          or fitBounds in overview)         │
 *  ├────────────────────────────────────────────┤
 *  │ 總覽 · 7天  DAY 01 · 7/29  DAY 02 · ···   │  day tabs (snap-scroll)
 *  ├────────────────────────────────────────────┤
 *  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ···           │  entry cards (snap-scroll)
 *  │ │D1 10:45│ │D1 12:10│ │D2 13:00│ ···      │  (D{N} prefix only in overview)
 *  │ └────┘ └────┘ └────┘ └────┘                │
 *  └────────────────────────────────────────────┘
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTripContext } from '../contexts/TripContext';
import { extractPinsFromDay, extractPinsFromAllDays, type MapPin } from '../hooks/useMapData';
import { dayColor } from '../lib/dayPalette';
import { findEntryInDays, formatDateLabel } from '../lib/mapDay';
import Icon from '../components/shared/Icon';
import TriplineLogo from '../components/shared/TriplineLogo';
import BreadcrumbCrumbs from '../components/shared/BreadcrumbCrumbs';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

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
  font-size: var(--font-size-caption2); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
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
.map-page-empty {
  height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--color-muted); gap: 8px;
  padding: 24px;
}

/* ===== Day tabs — underlined tabs style (對齊 DayNav desktop) ===== */
.map-page-days {
  flex-shrink: 0;
  background: var(--color-glass-nav);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-top: 1px solid var(--color-border);
  display: flex; gap: 2px;
  overflow-x: auto; scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  padding: 0 12px;
  scrollbar-width: none;
}
.map-page-days::-webkit-scrollbar { display: none; }
.map-page-day-tab {
  flex: 0 0 auto; scroll-snap-align: start;
  padding: 12px 14px;
  border: none; border-bottom: 2px solid transparent; border-radius: 0;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer; font-family: inherit;
  display: inline-flex; align-items: center; gap: 6px;
  min-height: var(--spacing-tap-min, 44px); white-space: nowrap;
  transition: color 160ms var(--transition-timing-function-apple),
              border-bottom-color 160ms var(--transition-timing-function-apple);
}
.map-page-day-tab:hover:not([aria-pressed="true"]) { color: var(--color-foreground); }
.map-page-day-tab[aria-pressed="true"] {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}
.map-page-day-tab-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700; letter-spacing: 0.14em;
  opacity: 0.7; text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
.map-page-day-tab[aria-pressed="true"] .map-page-day-tab-eyebrow { opacity: 1; }
.map-page-day-tab-date {
  font-size: 13px; font-weight: 600;
  font-variant-numeric: tabular-nums; letter-spacing: -0.005em;
  line-height: 1;
  color: var(--color-foreground);
}
.map-page-day-tab[aria-pressed="true"] .map-page-day-tab-date { color: var(--color-accent); }

/* ===== Entry cards — swipe snap (Funliday style) ===== */
.map-page-cards {
  flex-shrink: 0;
  display: flex; gap: 10px;
  overflow-x: auto; scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  /* Padding so first/last card can snap to centre (card width = 220px, half = 110px) */
  padding: 12px max(16px, calc(50% - 110px)) calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--color-background);
  scrollbar-width: none;
}
.map-page-cards::-webkit-scrollbar { display: none; }
.map-page-card {
  flex: 0 0 220px; scroll-snap-align: center;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-background);
  color: var(--color-foreground);
  cursor: pointer; font-family: inherit;
  text-align: left;
  transition: border-color 160ms var(--transition-timing-function-apple),
              box-shadow 160ms var(--transition-timing-function-apple);
}
.map-page-card:hover:not([aria-pressed="true"]) { border-color: var(--color-muted); }
.map-page-card[aria-pressed="true"] {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 20%, transparent);
}
.map-page-card-top {
  display: inline-flex; align-items: baseline; gap: 8px;
  margin-bottom: 4px;
}
.map-page-card-num {
  display: inline-grid; place-items: center;
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--color-tertiary);
  color: var(--color-muted);
  font-size: var(--font-size-caption2); font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.map-page-card[aria-pressed="true"] .map-page-card-num {
  background: var(--color-accent); color: #fff;
}
.map-page-card-time {
  font-size: 13px; font-weight: 600;
  font-variant-numeric: tabular-nums; letter-spacing: -0.005em;
  color: var(--color-foreground);
}
.map-page-card-title {
  font-size: 14px; font-weight: 500;
  color: var(--color-foreground);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}
.map-page-card-empty {
  flex: 0 0 auto;
  padding: 10px 12px;
  color: var(--color-muted);
  font-size: 13px;
}

@media (max-width: 760px) {
  .map-page-crumb { font-size: var(--font-size-eyebrow); letter-spacing: 0.12em; }
  .map-page-card { flex: 0 0 200px; }
}
`;

/* ===== Helpers ===== */

interface DayTab {
  dayNum: number;
  date: string | null;
  label: string | null;
}

/* ===== Component ===== */

export default function MapPage() {
  const { tripId, entryId: entryIdStr } = useParams<{ tripId: string; entryId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { trip, allDays, loading } = useTripContext();

  const urlEntryId = entryIdStr ? Number(entryIdStr) : null;

  /* --- Day list --- */
  const dayTabs: DayTab[] = useMemo(() => {
    if (!allDays) return [];
    return Object.keys(allDays)
      .map((n) => Number(n))
      .sort((a, b) => a - b)
      .map((dayNum) => {
        const d = allDays[dayNum]!;
        return { dayNum, date: d.date ?? null, label: d.label ?? null };
      });
  }, [allDays]);

  /* --- Initial active tab: 'overview' | number --- */
  // URL 解析順序：?day=all → 'overview'；entry 存在 → 對應 day；?day=N → N；否則第 1 天
  const initialTab: 'overview' | number = useMemo(() => {
    if (!allDays) return 1;
    if (urlEntryId != null) {
      const ctx = findEntryInDays(allDays, urlEntryId);
      if (ctx) return ctx.dayNum;
    }
    const q = searchParams.get('day');
    if (q === 'all') return 'overview';
    if (q) {
      const n = Number(q);
      if (Number.isFinite(n) && allDays[n]) return n;
    }
    return dayTabs[0]?.dayNum ?? 1;
  }, [allDays, urlEntryId, searchParams, dayTabs]);

  const [activeTab, setActiveTab] = useState<'overview' | number>(initialTab);
  const isOverview = activeTab === 'overview';

  // Keep activeTab synced with URL on first load
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  /* --- Pins: overview vs single day --- */
  const overviewData = useMemo(() => {
    return isOverview ? extractPinsFromAllDays(allDays) : null;
  }, [isOverview, allDays]);

  const currentDay = !isOverview && typeof activeTab === 'number' ? allDays?.[activeTab] : undefined;
  const singleDayPins = useMemo(() => {
    if (!currentDay) return [];
    return extractPinsFromDay(currentDay).pins;
  }, [currentDay]);

  // Flat pins passed to OceanMap (overview aggregates all days)
  const mapPins: MapPin[] = useMemo(() => {
    if (isOverview && overviewData) return overviewData.pins;
    return singleDayPins;
  }, [isOverview, overviewData, singleDayPins]);

  // Entry pins for card list — overview aggregates, single day filters to this day
  const cardEntryPins = useMemo(() => {
    if (isOverview && overviewData) {
      return overviewData.pins.filter((p) => p.type === 'entry');
    }
    return singleDayPins.filter((p) => p.type === 'entry');
  }, [isOverview, overviewData, singleDayPins]);

  // Entry id → dayNum map (used for overview card's day prefix)
  const entryDayMap = useMemo(() => {
    const m = new Map<number, number>();
    if (overviewData) {
      overviewData.pinsByDay.forEach((pins, dayNum) => {
        pins.forEach((p) => m.set(p.id, dayNum));
      });
    }
    return m;
  }, [overviewData]);

  const [activeEntryId, setActiveEntryId] = useState<number | null>(urlEntryId);

  // When tab changes (or first load), default active entry to URL entry or first card.
  // Overview mode without explicit entryId: leave unfocused so OceanMap falls back to
  // fitBounds (shows whole trip) instead of flyTo on first pin.
  useEffect(() => {
    if (urlEntryId != null && cardEntryPins.some((p) => p.id === urlEntryId)) {
      setActiveEntryId(urlEntryId);
      return;
    }
    setActiveEntryId(isOverview ? null : (cardEntryPins[0]?.id ?? null));
  }, [activeTab, urlEntryId, cardEntryPins, isOverview]);

  /* --- Switch tab --- */
  const handleTabClick = useCallback((tab: 'overview' | number) => {
    setActiveTab(tab);
    const dayParam = tab === 'overview' ? 'all' : String(tab);
    // Strip entry segment when switching tab via URL
    if (urlEntryId != null) {
      navigate(`/trip/${tripId}/map?day=${dayParam}`);
    } else {
      const next = new URLSearchParams(searchParams);
      next.set('day', dayParam);
      setSearchParams(next, { replace: true });
    }
  }, [tripId, navigate, searchParams, setSearchParams, urlEntryId]);

  /* --- Card scroll → active entry (IntersectionObserver) --- */
  const cardsRef = useRef<HTMLDivElement | null>(null);
  const scrollingProgrammatically = useRef(false);

  useEffect(() => {
    const container = cardsRef.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-card-entry-id]'));
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingProgrammatically.current) return;
        // Pick the most-visible card (threshold ≥ 0.6 means pretty centred)
        const mostVisible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0.5)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (mostVisible) {
          const id = Number((mostVisible.target as HTMLElement).dataset.cardEntryId);
          if (Number.isFinite(id)) {
            setActiveEntryId((prev) => (prev === id ? prev : id));
          }
        }
      },
      { root: container, threshold: [0.5, 0.7, 0.9] },
    );

    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [cardEntryPins, activeTab]);

  /* --- Card click → scroll into view + set active --- */
  const handleCardClick = useCallback((entryId: number) => {
    setActiveEntryId((prev) => (prev === entryId ? prev : entryId));
    const el = cardsRef.current?.querySelector<HTMLElement>(`[data-card-entry-id="${entryId}"]`);
    if (!el) return;
    scrollingProgrammatically.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    setTimeout(() => { scrollingProgrammatically.current = false; }, 400);
  }, []);

  /* --- On tab change / initial mount: scroll active card into centre BEFORE IO stabilises --- */
  useEffect(() => {
    if (cardEntryPins.length === 0) return;
    const targetId = activeEntryId ?? cardEntryPins[0]!.id;
    const el = cardsRef.current?.querySelector<HTMLElement>(`[data-card-entry-id="${targetId}"]`);
    if (!el || !cardsRef.current) return;
    scrollingProgrammatically.current = true;
    el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
    const t = setTimeout(() => { scrollingProgrammatically.current = false; }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, cardEntryPins.length]);

  /* --- Breadcrumb --- */
  const crumb = useMemo(() => {
    if (isOverview) {
      // 用 dayTabs 第一/最後日期組 trip date range
      const first = dayTabs[0]?.date;
      const last = dayTabs[dayTabs.length - 1]?.date;
      const range = first && last && first !== last
        ? `${formatDateLabel(first)} – ${formatDateLabel(last)}`
        : first ? formatDateLabel(first) : null;
      return range ? `總覽 · ${range}` : '總覽';
    }
    const parts: string[] = [];
    const dayNum = activeTab as number;
    parts.push(`DAY ${String(dayNum).padStart(2, '0')}`);
    const day = allDays?.[dayNum];
    if (day?.date) parts.push(formatDateLabel(day.date));
    if (day?.label) parts.push(day.label);
    return parts.join(' · ');
  }, [activeTab, isOverview, allDays, dayTabs]);

  /* --- Back navigation --- */
  const onBack = useCallback(() => {
    if (urlEntryId != null) navigate(`/trip/${tripId}/stop/${urlEntryId}`);
    else navigate(`/trip/${tripId}`);
  }, [tripId, navigate, urlEntryId]);

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
          <BreadcrumbCrumbs parts={crumb.split(' · ')} classPrefix="map-page-crumb" />
        </div>
        <TriplineLogo isOnline={isOnline} />
      </header>

      <main className="map-page-body">
        {loading ? (
          <div className="map-page-empty"><span>載入中…</span></div>
        ) : mapPins.length === 0 ? (
          <div className="map-page-empty">
            <span>{isOverview ? '這趟行程尚無位置資訊' : '這天沒有位置資訊'}</span>
          </div>
        ) : (
          <Suspense fallback={<div className="map-page-empty"><span>地圖載入中…</span></div>}>
            <OceanMap
              pins={mapPins}
              mode="overview"
              focusId={activeEntryId ?? undefined}
              routes={true}
              cluster={!isOverview ? false : undefined}
              fillParent={true}
              pinsByDay={isOverview ? overviewData?.pinsByDay : undefined}
              dayNum={isOverview ? undefined : (activeTab as number)}
            />
          </Suspense>
        )}
      </main>

      {dayTabs.length > 1 && (
        <nav className="map-page-days" role="tablist" aria-label="行程日期">
          {/* 「總覽」tab prepend 於 Day 01 之前 */}
          <button
            key="overview"
            type="button"
            role="tab"
            className="map-page-day-tab"
            aria-pressed={isOverview}
            aria-selected={isOverview}
            onClick={() => handleTabClick('overview')}
          >
            <span className="map-page-day-tab-eyebrow">總覽</span>
            <span className="map-page-day-tab-date">{dayTabs.length} 天</span>
          </button>
          {dayTabs.map((t) => {
            const isActive = !isOverview && t.dayNum === activeTab;
            const color = dayColor(t.dayNum);
            return (
              <button
                key={t.dayNum}
                type="button"
                role="tab"
                className="map-page-day-tab"
                aria-pressed={isActive}
                aria-selected={isActive}
                onClick={() => handleTabClick(t.dayNum)}
                style={isActive ? { borderBottomColor: color } : undefined}
              >
                <span className="map-page-day-tab-eyebrow" style={isActive ? { color } : undefined}>DAY {String(t.dayNum).padStart(2, '0')}</span>
                <span className="map-page-day-tab-date">{formatDateLabel(t.date)}</span>
              </button>
            );
          })}
        </nav>
      )}

      <div className="map-page-cards" ref={cardsRef}>
        {cardEntryPins.length === 0 ? (
          <div className="map-page-card-empty">
            {isOverview ? '這趟行程尚無景點' : '這天沒有景點'}
          </div>
        ) : (
          cardEntryPins.map((pin) => {
            const isActive = pin.id === activeEntryId;
            const pinDay = entryDayMap.get(pin.id);
            return (
              <button
                key={pin.id}
                type="button"
                className="map-page-card"
                data-card-entry-id={pin.id}
                aria-pressed={isActive}
                onClick={() => handleCardClick(pin.id)}
              >
                <div className="map-page-card-top">
                  <span className="map-page-card-num">{pin.index}</span>
                  {/* Overview mode: 顯示 DAY N prefix，用 dayColor */}
                  {isOverview && pinDay && (
                    <span className="map-page-card-time" style={{ color: dayColor(pinDay) }}>
                      D{pinDay}
                    </span>
                  )}
                  {pin.time && <span className="map-page-card-time">{pin.time}</span>}
                </div>
                <p className="map-page-card-title">{pin.title || '（無標題）'}</p>
              </button>
            );
          })
        )}
      </div>

      {/* Trip title for a11y / fallback */}
      {trip?.title && (
        <span className="sr-only" aria-hidden="true">{trip.title}</span>
      )}
    </div>
  );
}
