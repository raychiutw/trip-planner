/**
 * GlobalMapPage — V2 全域地圖（mockup-map-v2.html 對齊，user-revised）
 *
 * Route: /map
 *
 * Design deviation from mockup: mockup 顯示所有 trip 同時，user 指示
 * 改成「挑一個 trip 顯示 + dropdown 切換 + 沒 trip → 新增行程 CTA」。
 *
 * Layout:
 *   - Desktop ≥1024px: 3-pane (sidebar | map main | sheet POI detail)
 *   - Mobile <1024px: 1-pane map + bottom nav
 *
 * Map render:
 *   - 重用 `OceanMap mode="overview"` — 內建 useRoute 走 /api/route
 *     proxy（Mapbox driving directions），落地真實導航折線而不是直線；
 *     失敗時自動 fallback Haversine straight line（標 approx）。
 *   - Per-day polyline 按 dayColor(N)，hotel sortOrder=-1 入線（DESIGN.md
 *     「地圖 Polyline 規格」）。
 *   - 點 marker → setSelected → 右側 sheet 顯示 POI detail，flyTo 該 pin。
 *
 * Empty state: 沒任何 trip → terracotta hero + 「+ 新增行程」按鈕走
 * useNewTrip().openModal。
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useDarkMode } from '../hooks/useDarkMode';
import { useNewTrip } from '../contexts/NewTripContext';
import { extractPinsFromDay, type MapPin } from '../hooks/useMapData';
import { apiFetch } from '../lib/apiClient';
import { lsGet, lsSet, LS_KEY_TRIP_PREF } from '../lib/localStorage';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import Icon from '../components/shared/Icon';
import type { Day } from '../types/trip';

// OceanMap is heavy (leaflet + supercluster). Lazy-load so /map's first paint
// (header + sheet skeleton) lands before the leaflet bundle finishes parsing.
const OceanMap = lazy(() => import('../components/trip/OceanMap'));

interface MyTripRow { tripId: string; }
interface TripSummary {
  tripId: string;
  name?: string;
  title?: string | null;
  countries?: string | null;
  day_count?: number;
  start_date?: string | null;
  end_date?: string | null;
}

interface ResolvedTrip {
  tripId: string;
  name: string;
  countries: string;
  pins: MapPin[];
  pinsByDay: Map<number, MapPin[]>;
}

const SCOPED_STYLES = `
.tp-global-map-shell {
  position: relative;
  height: 100%;
  width: 100%;
  background: var(--color-secondary);
  display: flex; flex-direction: column;
}

/* Header — trip switcher */
.tp-global-map-header {
  position: absolute; top: 16px; left: 16px;
  z-index: 20;
  pointer-events: auto;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 10px 14px;
  display: flex; flex-direction: column; gap: 6px;
  min-width: 240px; max-width: min(420px, calc(100% - 32px));
}
.tp-global-map-header-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted);
}
.tp-global-map-header-row {
  display: flex; align-items: center; gap: 8px;
}
.tp-global-map-trip-btn {
  flex: 1;
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  font: inherit; font-size: var(--font-size-callout); font-weight: 700;
  color: var(--color-foreground); cursor: pointer;
  min-height: 36px;
  text-align: left;
}
.tp-global-map-trip-btn:hover { border-color: var(--color-accent); }
.tp-global-map-trip-btn .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tp-global-map-trip-btn .caret { font-size: 12px; color: var(--color-muted); flex-shrink: 0; }
.tp-global-map-meta {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.tp-global-map-dropdown {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  max-height: 360px; overflow-y: auto;
  padding: 4px;
  z-index: 25;
}
.tp-global-map-dropdown-row {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: none; background: transparent;
  font: inherit; cursor: pointer; width: 100%;
  color: var(--color-foreground); text-align: left;
}
.tp-global-map-dropdown-row:hover { background: var(--color-hover); }
.tp-global-map-dropdown-row.is-active { background: var(--color-accent-subtle); color: var(--color-accent); }
.tp-global-map-dropdown-row .row-title { font-weight: 700; font-size: var(--font-size-callout); }
.tp-global-map-dropdown-row .row-meta { font-size: var(--font-size-caption2); color: var(--color-muted); }

/* Map canvas — fills shell, header floats over it */
.tp-global-map-canvas {
  flex: 1; min-height: 0;
  position: relative;
}
.tp-global-map-canvas .ocean-map-container { height: 100%; }

/* Empty state — no trips at all */
.tp-global-map-empty {
  flex: 1; min-height: 0;
  display: grid; place-items: center;
  padding: 32px 24px;
  background: linear-gradient(135deg, var(--color-accent-subtle) 0%, var(--color-tertiary) 100%);
}
.tp-global-map-empty-card {
  max-width: 480px; text-align: center;
  display: flex; flex-direction: column; gap: 16px; align-items: center;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 36px 28px;
}
.tp-global-map-empty-icon {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
}
.tp-global-map-empty h2 {
  font-size: var(--font-size-title2); font-weight: 800;
  letter-spacing: -0.01em; margin: 0;
}
.tp-global-map-empty p {
  color: var(--color-muted); font-size: var(--font-size-callout);
  line-height: 1.55; margin: 0;
}
.tp-global-map-empty .cta {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 22px;
  border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: none; cursor: pointer;
  font: inherit; font-weight: 700; font-size: var(--font-size-callout);
  min-height: var(--spacing-tap-min);
}
.tp-global-map-empty .cta:hover { filter: brightness(var(--hover-brightness)); }

.tp-global-map-loading {
  flex: 1; display: grid; place-items: center;
  color: var(--color-muted);
}

/* Right sheet — selected POI detail */
.tp-global-map-sheet {
  padding: 20px 20px 32px;
}
.tp-global-map-sheet-empty {
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  line-height: 1.55;
}
.tp-global-map-sheet-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--font-size-eyebrow); font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--color-muted);
  margin-bottom: 8px;
}
.tp-global-map-sheet-eyebrow .dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-accent);
}
.tp-global-map-sheet h2 {
  font-size: var(--font-size-title2); font-weight: 800;
  letter-spacing: -0.01em; margin: 0 0 10px;
}
.tp-global-map-sheet .meta {
  display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;
}
.tp-global-map-sheet .chip {
  display: inline-flex; padding: 4px 10px;
  border: 1px solid var(--color-border); border-radius: var(--radius-full);
  font-size: var(--font-size-caption); font-weight: 600;
  background: var(--color-background); color: var(--color-muted);
}
.tp-global-map-sheet .chip.accent {
  background: var(--color-accent-subtle); color: var(--color-accent);
  border-color: var(--color-accent);
}
.tp-global-map-sheet .info-row {
  display: flex; justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-footnote);
}
.tp-global-map-sheet .info-row:last-child { border-bottom: none; }
.tp-global-map-sheet .info-row .info-label { color: var(--color-muted); }
.tp-global-map-sheet .open-trip-btn {
  display: inline-flex; align-items: center; justify-content: center;
  margin-top: 16px; padding: 10px 16px;
  border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  text-decoration: none; font: inherit; font-weight: 700;
  font-size: var(--font-size-callout);
}
.tp-global-map-sheet .open-trip-btn:hover { filter: brightness(var(--hover-brightness)); }

/* Mobile floating selected card (sheet hidden) */
.tp-global-map-mobile-card {
  position: absolute; left: 12px; right: 12px; bottom: 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  box-shadow: var(--shadow-lg);
  z-index: 6;
  display: none;
}
@media (max-width: 1023px) {
  .tp-global-map-mobile-card.is-active { display: block; }
}
`;

function trimCountry(c: string | null | undefined): string {
  return (c ?? '').trim().toUpperCase();
}

function dateRange(start: string | null | undefined, end: string | null | undefined): string {
  function fmt(iso: string): string {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(iso);
    if (!m) return iso;
    return `${parseInt(m[2]!, 10)}/${parseInt(m[3]!, 10)}`;
  }
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return start ? fmt(start) : end ? fmt(end) : '';
}

export default function GlobalMapPage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const { isDark } = useDarkMode();
  const { openModal: openNewTrip } = useNewTrip();

  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedTrip | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Step 1: fetch my trips + meta on mount.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [myRes, allRes] = await Promise.all([
          fetch('/api/my-trips', { credentials: 'same-origin' }),
          fetch('/api/trips?all=1', { credentials: 'same-origin' }),
        ]);
        if (cancelled) return;
        if (!myRes.ok) {
          if (myRes.status === 401 || myRes.status === 403) return;
          setError('無法載入行程清單。');
          return;
        }
        const myJson = (await myRes.json()) as MyTripRow[];
        const allJson = allRes.ok ? ((await allRes.json()) as TripSummary[]) : [];
        const mine = new Set(myJson.map((r) => r.tripId));
        const myTrips = allJson.filter((t) => mine.has(t.tripId));
        setTrips(myTrips);
        if (myTrips.length === 0) return;
        const pref = lsGet<string>(LS_KEY_TRIP_PREF);
        const initial = pref && myTrips.some((t) => t.tripId === pref) ? pref : myTrips[0]!.tripId;
        setActiveTripId(initial);
      } catch {
        if (!cancelled) setError('網路連線失敗，請稍後再試。');
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Step 2: when activeTripId changes, fetch its days + extract pins.
  useEffect(() => {
    if (!activeTripId) { setResolved(null); return; }
    let cancelled = false;
    async function loadTrip() {
      try {
        const rawDays = await apiFetch<Record<string, unknown>[]>(
          `/trips/${activeTripId}/days?all=1`,
        );
        if (cancelled) return;
        const pins: MapPin[] = [];
        const pinsByDay = new Map<number, MapPin[]>();
        for (const rd of rawDays) {
          const day: Day = {
            id: rd.id as number,
            dayNum: rd.dayNum as number,
            date: (rd.date as string | null | undefined) ?? null,
            dayOfWeek: (rd.dayOfWeek as string | null | undefined) ?? null,
            label: (rd.label as string | null | undefined) ?? null,
            hotel: (rd.hotel as Day['hotel']) ?? null,
            timeline: (rd.timeline as Day['timeline']) ?? [],
          };
          const { pins: dayPins } = extractPinsFromDay(day);
          pins.push(...dayPins);
          pinsByDay.set(day.dayNum, dayPins);
        }
        const meta = trips?.find((t) => t.tripId === activeTripId);
        setResolved({
          tripId: activeTripId!,
          name: meta?.title || meta?.name || activeTripId!,
          countries: trimCountry(meta?.countries),
          pins,
          pinsByDay,
        });
        setSelectedPinId(null);
      } catch {
        if (!cancelled) setError('無法載入該行程資料。');
      }
    }
    void loadTrip();
    return () => { cancelled = true; };
  }, [activeTripId, trips]);

  // Close trip menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const onMarkerClick = useCallback((pinId: number) => {
    setSelectedPinId(pinId);
  }, []);

  const pickTrip = useCallback((tripId: string) => {
    setActiveTripId(tripId);
    lsSet(LS_KEY_TRIP_PREF, tripId);
    setMenuOpen(false);
    setSelectedPinId(null);
  }, []);

  const selectedPin = useMemo(() => {
    if (!resolved || selectedPinId == null) return null;
    return resolved.pins.find((p) => p.id === selectedPinId) ?? null;
  }, [resolved, selectedPinId]);

  // Loading: trips list still null
  const isLoadingList = trips === null && !error;
  const hasNoTrips = trips !== null && trips.length === 0;

  const main = (
    <div className="tp-global-map-shell" data-testid="global-map-page">
      <style>{SCOPED_STYLES}</style>

      {hasNoTrips ? (
        <div className="tp-global-map-empty" data-testid="global-map-empty">
          <div className="tp-global-map-empty-card">
            <div className="tp-global-map-empty-icon" aria-hidden="true">
              <Icon name="map" />
            </div>
            <h2>還沒有行程可以看</h2>
            <p>新增第一個行程後，這裡就會把所有景點點在地圖上、用真實導航路線連起來。</p>
            <button
              type="button"
              className="cta"
              onClick={openNewTrip}
              data-testid="global-map-new-trip"
            >
              <span aria-hidden="true">+</span>
              <span>新增行程</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Floating trip switcher header (over map). */}
          {trips && trips.length > 0 && (
            <div className="tp-global-map-header" ref={menuRef} data-testid="global-map-trip-switcher">
              <div className="tp-global-map-header-eyebrow">Global Map</div>
              <div className="tp-global-map-header-row">
                <button
                  type="button"
                  className="tp-global-map-trip-btn"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  data-testid="global-map-trip-btn"
                >
                  <span className="name">
                    {resolved?.name ?? trips.find((t) => t.tripId === activeTripId)?.title ?? activeTripId ?? '選擇行程'}
                  </span>
                  <span className="caret" aria-hidden="true">▾</span>
                </button>
              </div>
              <div className="tp-global-map-meta">
                {resolved
                  ? `${resolved.pins.length} stops · ${resolved.pinsByDay.size} days`
                  : '載入中…'}
              </div>
              {menuOpen && (
                <div className="tp-global-map-dropdown" role="menu" data-testid="global-map-trip-menu">
                  {trips.map((t) => (
                    <button
                      key={t.tripId}
                      type="button"
                      className={`tp-global-map-dropdown-row ${t.tripId === activeTripId ? 'is-active' : ''}`}
                      onClick={() => pickTrip(t.tripId)}
                      role="menuitem"
                      data-testid={`global-map-trip-pick-${t.tripId}`}
                    >
                      <span className="row-title">{t.title || t.name || t.tripId}</span>
                      <span className="row-meta">
                        {trimCountry(t.countries) || '—'}
                        {dateRange(t.start_date, t.end_date) ? ` · ${dateRange(t.start_date, t.end_date)}` : ''}
                        {typeof t.day_count === 'number' && t.day_count > 0 ? ` · ${t.day_count} days` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Map canvas — fills shell behind header */}
          <div className="tp-global-map-canvas" data-testid="global-map-canvas">
            {isLoadingList && <div className="tp-global-map-loading">載入中…</div>}
            {resolved && (
              <Suspense fallback={<div className="tp-global-map-loading">載入地圖…</div>}>
                <OceanMap
                  pins={resolved.pins}
                  pinsByDay={resolved.pinsByDay}
                  mode="overview"
                  routes
                  fillParent
                  focusId={selectedPinId ?? undefined}
                  onMarkerClick={onMarkerClick}
                  dark={isDark}
                  className="ocean-map-container"
                />
              </Suspense>
            )}
            {error && (
              <div className="tp-global-map-loading" style={{ color: 'var(--color-destructive)' }}>{error}</div>
            )}

            {/* Mobile-only floating selected POI card */}
            <div
              className={`tp-global-map-mobile-card ${selectedPin ? 'is-active' : ''}`}
              data-testid="global-map-mobile-card"
            >
              {selectedPin && resolved && (
                <>
                  <div className="tp-global-map-sheet-eyebrow">
                    <span className="dot" />
                    <span>{resolved.name}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-headline)', marginBottom: 4 }}>
                    {selectedPin.title}
                  </div>
                  {selectedPin.time && (
                    <div style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-footnote)' }}>
                      {selectedPin.time}
                    </div>
                  )}
                  <Link
                    to={`/trips?selected=${encodeURIComponent(resolved.tripId)}`}
                    className="open-trip-btn"
                    style={{ marginTop: 10 }}
                  >
                    打開行程
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const sheet = (
    <div className="tp-global-map-sheet" data-testid="global-map-sheet">
      <style>{SCOPED_STYLES}</style>
      {selectedPin && resolved ? (
        <>
          <div className="tp-global-map-sheet-eyebrow">
            <span className="dot" />
            <span>{resolved.name}</span>
          </div>
          <h2>{selectedPin.title}</h2>
          <div className="meta">
            {resolved.countries && <span className="chip accent">{resolved.countries}</span>}
            {selectedPin.time && <span className="chip">{selectedPin.time}</span>}
            {typeof selectedPin.googleRating === 'number' && (
              <span className="chip">★ {selectedPin.googleRating.toFixed(1)}</span>
            )}
          </div>
          <div className="info-row">
            <span className="info-label">座標</span>
            <span>{selectedPin.lat.toFixed(4)}, {selectedPin.lng.toFixed(4)}</span>
          </div>
          {selectedPin.travelMin != null && (
            <div className="info-row">
              <span className="info-label">前一站交通</span>
              <span>{selectedPin.travelType ?? '—'} {selectedPin.travelMin} 分</span>
            </div>
          )}
          <Link
            to={`/trips?selected=${encodeURIComponent(resolved.tripId)}`}
            className="open-trip-btn"
            data-testid="sheet-open-trip"
          >
            打開行程
          </Link>
        </>
      ) : (
        <div className="tp-global-map-sheet-empty">
          {resolved
            ? '點地圖上的標記查看景點細節。線段是真實導航路線。'
            : hasNoTrips
              ? '左側建立第一個行程後，地圖會用真實導航路線把每個景點串起來。'
              : '挑一個行程來看地圖。'}
        </div>
      )}
    </div>
  );

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={main}
      sheet={sheet}
      bottomNav={<GlobalBottomNav authed={!!user} />}
    />
  );
}
