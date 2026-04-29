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
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import MapDayTab from '../components/trip/MapDayTab';
import MapEntryCard, { type EntryKind } from '../components/trip/MapEntryCard';
import MapFabs from '../components/trip/MapFabs';
import { useCurrentUser } from '../hooks/useCurrentUser';
import type * as L from 'leaflet';

const OceanMap = lazy(() => import('../components/trip/OceanMap'));

const SCOPED_STYLES = `
.map-page-wrap {
  /* AppShell main 已 lock 100dvh + 為 fixed GlobalBottomNav 留 padding-bottom。
   * 此 wrap 對齊 ChatPage .tp-chat-shell pattern 用 height: 100% 填滿 main
   * content-area,不要用 100dvh(會撐到 viewport 蓋過 bottom-nav 跟 day tabs)。 */
  height: 100%;
  display: flex; flex-direction: column;
  background: var(--color-background);
  overflow: hidden;
}
.map-page-body {
  flex: 1;
  position: relative;
  min-height: 0;
}
.map-page-body > * { width: 100%; height: 100%; }

/* ===== Loading state — shimmer canvas + accent spinner（mockup Section 20） ===== */
.map-page-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-tertiary) 50%, var(--color-secondary) 100%);
  background-size: 200% 200%;
  animation: shimmer 2s ease-in-out infinite;
  z-index: 4;
}
.map-page-loading-stack {
  display: flex; flex-direction: column;
  align-items: center; gap: 12px;
}
.map-page-loading-spinner {
  width: 32px; height: 32px;
  border: 2.5px solid color-mix(in srgb, var(--color-accent) 20%, transparent);
  border-top-color: var(--color-accent);
  border-radius: var(--radius-full);
  animation: tp-spin 800ms linear infinite;
}
.map-page-loading-text {
  font-size: var(--font-size-footnote);
  font-weight: 600;
  color: var(--color-muted);
  margin: 0;
}

/* ===== Empty state — glass card（mockup Section 20） ===== */
.map-page-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 4;
}
.map-page-empty-card {
  text-align: center;
  padding: 24px 28px;
  background: var(--color-glass-nav);
  backdrop-filter: blur(var(--blur-glass, 14px));
  -webkit-backdrop-filter: blur(var(--blur-glass, 14px));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  max-width: 280px;
  box-shadow: var(--shadow-md);
}
.map-page-empty-icon {
  width: 32px; height: 32px;
  color: var(--color-muted);
  margin: 0 auto 8px;
  display: grid; place-items: center;
}
.map-page-empty-icon svg { width: 32px; height: 32px; }
.map-page-empty-title {
  font-size: var(--font-size-callout);
  font-weight: 700;
  margin: 0 0 4px;
}
.map-page-empty-text {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin: 0;
  line-height: 1.5;
}

/* ===== Map page entry cards centering override =====
 * tp-map-entry-cards 的基礎樣式在 tokens.css；MapPage 額外加 scroll-snap 與
 * 中心 padding（first/last card 能 snap 到 viewport center）。 */
.map-page-cards {
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  /* Padding so first/last card can snap to centre (card width = 220px, half = 110px) */
  padding: 12px max(16px, calc(50% - 110px)) calc(12px + env(safe-area-inset-bottom, 0px));
}
.map-page-cards .tp-map-entry-card { scroll-snap-align: center; }
.map-page-card-empty {
  flex: 0 0 auto;
  padding: 10px 12px;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}

@media (max-width: 760px) {
  .map-page-cards .tp-map-entry-card { flex: 0 0 200px; }
}

`;

/**
 * inferKind — 從 pin.title 推 entry kind（heuristic）。
 * MapPin 沒 kind metadata，這個是過渡方案；待 entries schema 加 kind 欄位後可移除。
 * Hotel pin 直接走 type === 'hotel'。
 */
function inferKind(pin: { type: string; title: string }): EntryKind {
  if (pin.type === 'hotel') return 'hotel';
  const t = pin.title;
  if (/食堂|餐廳|餐|食|麵|拉麵|烏龍|壽司|sushi|ramen|cafe|coffee|restaurant|noodle|燒|定食|烤|料理|燒肉|烤肉/i.test(t)) return 'food';
  if (/購物|商店|outlet|百貨|超市|mart|store|商場|藥妝|免稅|drug|drugstore|店|shop/i.test(t)) return 'shopping';
  return 'sight';
}

/* ===== Helpers ===== */

interface DayTab {
  dayNum: number;
  date: string | null;
  label: string | null;
}

interface TripSummary {
  tripId: string;
  name?: string;
  title?: string | null;
  countries?: string | null;
}

interface MyTripRow {
  tripId: string;
}

/* ===== Component ===== */

export default function MapPage() {
  const { tripId, entryId: entryIdStr } = useParams<{ tripId: string; entryId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { trip, allDays, loading } = useTripContext();

  /* 2026-04-29:trip-picker(對齊 mockup「Map Page」spec + shared
   * `.tp-titlebar-trip-picker` pattern)。fetch user 所有 trips for dropdown,
   * pickTrip → navigate /trip/:newId/map(整頁切換 trip context)。 */
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [tripMenuOpen, setTripMenuOpen] = useState(false);
  const tripMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [myRes, allRes] = await Promise.all([
          fetch('/api/my-trips', { credentials: 'same-origin' }),
          fetch('/api/trips?all=1', { credentials: 'same-origin' }),
        ]);
        if (cancelled) return;
        if (!myRes.ok || !allRes.ok) return;
        const myJson = (await myRes.json()) as MyTripRow[];
        const allJson = (await allRes.json()) as TripSummary[];
        const mine = new Set(myJson.map((r) => r.tripId));
        if (!cancelled) setTrips(allJson.filter((t) => mine.has(t.tripId)));
      } catch {
        /* silent — trip-picker only enhancement,fetch fail 隱藏 picker 即可 */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // close trip menu on outside click
  useEffect(() => {
    if (!tripMenuOpen) return;
    function onClick(e: MouseEvent) {
      if (tripMenuRef.current && !tripMenuRef.current.contains(e.target as Node)) {
        setTripMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [tripMenuOpen]);

  const pickTrip = useCallback((newTripId: string) => {
    setTripMenuOpen(false);
    if (newTripId === tripId) return;
    navigate(`/trip/${encodeURIComponent(newTripId)}/map`);
  }, [tripId, navigate]);

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

  // Section 4.10：MapFabs 需要 L.Map instance；OceanMap 透過 onMapReady prop
  // 在 mount 時 surface ref，unmount 時 reset 為 null。
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);

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

  // Entry pins for card list — mockup 規格：含 hotel（D1·1 Super Hotel 也在 cards）。
  // overview 模式聚合所有日；single day 模式只該日。
  const cardEntryPins = useMemo(() => {
    if (isOverview && overviewData) return overviewData.pins;
    return singleDayPins;
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

  // 2026-04-29 v2.17.14:user 拍板「地圖不需要回前頁箭頭」 — 移除 back button。
  // User navigates 出 map 走 sidebar / GlobalBottomNav 切換 nav,不需要 back。

  const { user } = useCurrentUser();

  const main = (
    <div className="map-page-wrap">
      <style>{SCOPED_STYLES}</style>

      <TitleBar
        title="地圖"
        actions={trips && trips.length > 0 && (
          <div className="tp-titlebar-trip-menu" ref={tripMenuRef}>
            <button
              type="button"
              className="tp-titlebar-trip-picker"
              onClick={() => setTripMenuOpen((o) => !o)}
              data-testid="map-trip-picker"
              aria-haspopup="menu"
              aria-expanded={tripMenuOpen}
              aria-label="切換行程"
            >
              <Icon name="swap-horiz" />
              <span className="tp-titlebar-trip-picker-name">
                {trip?.title || trip?.name || tripId || '選擇行程'}
              </span>
              <span className="tp-titlebar-trip-picker-chevron" aria-hidden="true">▾</span>
            </button>
            {tripMenuOpen && (
              <div className="tp-titlebar-trip-dropdown" role="menu">
                {trips.map((t) => (
                  <button
                    key={t.tripId}
                    type="button"
                    className={`tp-titlebar-trip-row ${t.tripId === tripId ? 'is-active' : ''}`}
                    onClick={() => pickTrip(t.tripId)}
                    role="menuitem"
                    data-testid={`map-trip-pick-${t.tripId}`}
                  >
                    <span className="tp-titlebar-trip-row-title">{t.title || t.name || t.tripId}</span>
                    <span className="tp-titlebar-trip-row-meta">{(t.countries ?? '').toUpperCase() || t.tripId}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      />

      <main className="map-page-body">
        {loading ? (
          <div className="map-page-loading" role="status" aria-busy="true" aria-live="polite">
            <div className="map-page-loading-stack">
              <div className="map-page-loading-spinner" aria-hidden="true" />
              <p className="map-page-loading-text">地圖載入中…</p>
            </div>
          </div>
        ) : mapPins.length === 0 ? (
          <div className="map-page-empty">
            <div className="map-page-empty-card">
              <span className="map-page-empty-icon" aria-hidden="true">
                <Icon name="map" />
              </span>
              <p className="map-page-empty-title">{isOverview ? '這趟行程尚無景點' : '此日尚無景點'}</p>
              <p className="map-page-empty-text">切換其他日期、或回到行程加入景點。</p>
            </div>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="map-page-loading" role="status" aria-busy="true" aria-live="polite">
                <div className="map-page-loading-stack">
                  <div className="map-page-loading-spinner" aria-hidden="true" />
                  <p className="map-page-loading-text">地圖載入中…</p>
                </div>
              </div>
            }
          >
            <OceanMap
              pins={mapPins}
              mode="overview"
              focusId={activeEntryId ?? undefined}
              routes={true}
              fillParent={true}
              pinsByDay={isOverview ? overviewData?.pinsByDay : undefined}
              dayNum={isOverview ? undefined : (activeTab as number)}
              onMapReady={setLeafletMap}
            />
          </Suspense>
        )}
        {/* Section 4.10：右下 FAB stack — 圖層切換 + 我的位置 */}
        <MapFabs map={leafletMap} />
      </main>

      {dayTabs.length > 1 && (
        <nav className="tp-map-day-tabs" role="tablist" aria-label="行程日期">
          {/* 「總覽」tab prepend 於 Day 01 之前 */}
          <MapDayTab
            key="overview"
            dayLabel="總覽"
            dateLabel={`${dayTabs.length} 天`}
            isActive={isOverview}
            onClick={() => handleTabClick('overview')}
          />
          {dayTabs.map((t) => (
            <MapDayTab
              key={t.dayNum}
              dayLabel={`DAY ${String(t.dayNum).padStart(2, '0')}`}
              dateLabel={formatDateLabel(t.date) ?? undefined}
              dayColor={dayColor(t.dayNum)}
              isActive={!isOverview && t.dayNum === activeTab}
              onClick={() => handleTabClick(t.dayNum)}
            />
          ))}
        </nav>
      )}

      <div className="tp-map-entry-cards map-page-cards" ref={cardsRef} role="list">
        {cardEntryPins.length === 0 ? (
          <div className="map-page-card-empty">
            {isOverview ? '這趟行程尚無景點' : '這天沒有景點'}
          </div>
        ) : (
          cardEntryPins.map((pin) => {
            const isActive = pin.id === activeEntryId;
            // Overview 模式：用 entryDayMap 反查；Single-day 模式：activeTab 即 dayNum
            const pinDay = isOverview ? entryDayMap.get(pin.id) : (activeTab as number);
            const color = pinDay ? dayColor(pinDay) : 'var(--color-muted)';
            return (
              <MapEntryCard
                key={pin.id}
                dataEntryId={pin.id}
                dayLocalIndex={pin.index}
                dayLabel={isOverview && pinDay ? `D${pinDay}` : undefined}
                dayColor={color}
                time={pin.time ?? undefined}
                title={pin.title || '（無標題）'}
                kind={inferKind(pin)}
                isActive={isActive}
                onClick={() => handleCardClick(pin.id)}
              />
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

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={main}
      bottomNav={<GlobalBottomNav authed={!!user} />}
    />
  );
}
