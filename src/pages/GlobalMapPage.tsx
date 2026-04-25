/**
 * GlobalMapPage — V2 全域地圖（mockup-map-v2.html parity, MVP）
 *
 * Route: /map
 *
 * Layout:
 *   - Desktop ≥1024px: 3-pane (sidebar | map main | sheet POI detail)
 *   - Mobile <1024px: 1-pane map + bottom nav
 *
 * Data:
 *   1. /api/my-trips → tripIds I have permission for
 *   2. /api/trips?all=1 → trip metadata (name, country)
 *   3. per trip: /api/trips/:id/days?all=1 → days + entries (with POI lat/lng)
 *
 * Render: each trip gets one of TRIP_PALETTE colors. Markers are colored
 * dots with a 2px white outline. Click marker → sheet shows POI detail
 * (desktop) or center-pans the map (mobile, since sheet is hidden).
 *
 * Polylines NOT drawn in MVP — would visually clash when many trips
 * overlap. Per-trip filter chips left for follow-up.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useDarkMode } from '../hooks/useDarkMode';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { extractPinsFromDay, type MapPin } from '../hooks/useMapData';
import { apiFetch } from '../lib/apiClient';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import type { Day } from '../types/trip';

interface MyTripRow { tripId: string; }
interface TripSummary {
  tripId: string;
  name?: string;
  title?: string | null;
  countries?: string | null;
  day_count?: number;
}
interface TripPinGroup {
  tripId: string;
  tripName: string;
  countries: string;
  color: string;
  /** Flat list — used for marker rendering, chip count, fitBounds. */
  pins: MapPin[];
  /** Day-grouped — used for polyline rendering (per DESIGN.md
   * 「地圖 Polyline 規格」: each day is its own segment, hotel leads the chain). */
  pinsByDay: Map<number, MapPin[]>;
}
interface SelectedPin {
  pin: MapPin;
  trip: TripPinGroup;
}

// 10-color terracotta palette (DESIGN.md Day palette analogue, scoped here
// for cross-trip visual differentiation).
const TRIP_PALETTE = [
  '#D97848', '#06A77D', '#0EA5C7', '#7C3AED', '#E11D48',
  '#65A30D', '#EA580C', '#0891B2', '#C026D3', '#10B981',
];

const SCOPED_STYLES = `
.tp-global-map-shell {
  position: relative;
  height: 100%;
  width: 100%;
  background: var(--color-secondary);
}
.tp-global-map-canvas {
  position: absolute; inset: 0;
  background: var(--color-tertiary);
}
.tp-global-map-overlay {
  position: absolute; top: 16px; left: 16px; right: 16px;
  pointer-events: none;
  display: flex; flex-direction: column; gap: 8px;
  align-items: flex-start;
  z-index: 5;
}
.tp-global-map-overlay-card {
  pointer-events: auto;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  box-shadow: var(--shadow-md);
  font-size: var(--font-size-footnote);
  max-width: min(420px, 100%);
}
.tp-global-map-overlay-card h2 {
  font-size: var(--font-size-callout); font-weight: 700;
  margin: 0 0 4px;
}
.tp-global-map-overlay-meta {
  color: var(--color-muted); font-size: var(--font-size-caption2);
}

/* Filter chips — click toggles per-trip layer visibility */
.tp-global-map-chips {
  pointer-events: auto;
  display: flex; flex-wrap: wrap; gap: 6px;
  max-width: 100%;
}
.tp-global-map-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: opacity 120ms, border-color 120ms;
  min-height: 32px;
  white-space: nowrap;
}
.tp-global-map-chip:hover { border-color: var(--color-accent); }
.tp-global-map-chip[aria-pressed="false"] {
  opacity: 0.45;
  text-decoration: line-through;
}
.tp-global-map-chip-dot {
  width: 10px; height: 10px; border-radius: 50%;
  border: 1.5px solid #fff; box-shadow: 0 0 0 1px var(--color-border);
}
.tp-global-map-chip-count {
  font-size: var(--font-size-caption2); font-weight: 700;
  padding: 0 6px; border-radius: 999px;
  background: var(--color-tertiary); color: var(--color-muted);
}

.tp-global-map-empty {
  position: absolute; inset: 0;
  display: grid; place-items: center;
  text-align: center; color: var(--color-muted);
  pointer-events: none;
  padding: 32px;
  font-size: var(--font-size-callout);
}

.tp-global-map-mobile-card {
  position: absolute; left: 12px; right: 12px; bottom: 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  box-shadow: var(--shadow-lg);
  z-index: 5;
  display: none;
}
@media (max-width: 1023px) {
  .tp-global-map-mobile-card.is-active { display: block; }
}

.tp-global-map-sheet {
  padding: 20px 20px 32px;
}
.tp-global-map-sheet-empty { color: var(--color-muted); font-size: var(--font-size-callout); line-height: 1.55; }
.tp-global-map-sheet-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--font-size-eyebrow); font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--color-muted);
  margin-bottom: 8px;
}
.tp-global-map-sheet-eyebrow .dot {
  width: 8px; height: 8px; border-radius: 50%;
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
`;

function trimCountry(c: string | null | undefined): string {
  return (c ?? '').trim().toUpperCase();
}

export default function GlobalMapPage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const { isDark } = useDarkMode();
  const { containerRef, map, fitBounds, flyTo } = useLeafletMap({ dark: isDark });

  const [groups, setGroups] = useState<TripPinGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedPin | null>(null);
  const [hiddenTripIds, setHiddenTripIds] = useState<Set<string>>(new Set());
  const layerRef = useRef<L.LayerGroup | null>(null);

  const toggleTrip = useCallback((tripId: string) => {
    setHiddenTripIds((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
    // If hidden trip's pin was selected, clear selection
    setSelected((s) => (s && s.trip.tripId === tripId ? null : s));
  }, []);

  // Fetch all trips + their days, extract POIs.
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
          setError('無法載入行程資料。');
          return;
        }
        const myJson = (await myRes.json()) as MyTripRow[];
        const allJson = allRes.ok ? ((await allRes.json()) as TripSummary[]) : [];
        const metaMap = new Map(allJson.map((t) => [t.tripId, t]));

        const result: TripPinGroup[] = [];
        for (let i = 0; i < myJson.length; i++) {
          if (cancelled) return;
          const tid = myJson[i]?.tripId;
          if (!tid) continue;
          try {
            const rawDays = await apiFetch<Record<string, unknown>[]>(
              `/trips/${tid}/days?all=1`,
            );
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
            const meta = metaMap.get(tid);
            result.push({
              tripId: tid,
              tripName: meta?.title || meta?.name || tid,
              countries: trimCountry(meta?.countries),
              color: TRIP_PALETTE[i % TRIP_PALETTE.length] ?? '#D97848',
              pins,
              pinsByDay,
            });
          } catch {
            // skip individual trip failures — don't blow up the whole map
          }
        }
        if (!cancelled) setGroups(result);
      } catch {
        if (!cancelled) setError('網路連線失敗，請稍後再試。');
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Render markers + per-trip polylines when map + groups + filter ready
  useEffect(() => {
    if (!map || !groups) return;
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;
    const visibleLatLngs: L.LatLngExpression[] = [];

    for (const group of groups) {
      if (hiddenTripIds.has(group.tripId)) continue;

      // Per-day polyline: hotel (sortOrder=-1) leads the chain, then entries
      // by sortOrder. Cross-day segments NOT drawn (avoids "hotel A → 餐廳 →
      // hotel B" visual nonsense). See DESIGN.md「地圖 Polyline 規格」.
      const sortedDays = [...group.pinsByDay.keys()].sort((a, b) => a - b);
      for (const dayNum of sortedDays) {
        const dayPins = [...(group.pinsByDay.get(dayNum) ?? [])].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        );
        if (dayPins.length < 2) continue;
        const coords: L.LatLngExpression[] = dayPins.map((p) => [p.lat, p.lng]);
        L.polyline(coords, {
          color: group.color,
          weight: 3,
          opacity: 0.7,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layer);
      }

      for (const pin of group.pins) {
        const html = `<div style="background:${group.color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35)"></div>`;
        const icon = L.divIcon({
          className: 'tp-global-marker',
          html,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const marker = L.marker([pin.lat, pin.lng], { icon, title: pin.title }).addTo(layer);
        marker.on('click', () => {
          setSelected({ pin, trip: group });
          flyTo([pin.lat, pin.lng], Math.max(map.getZoom(), 12));
        });
        visibleLatLngs.push([pin.lat, pin.lng]);
      }
    }

    if (visibleLatLngs.length > 0) fitBounds(visibleLatLngs);

    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map, groups, hiddenTripIds, fitBounds, flyTo]);

  const totalPins = useMemo(
    () => (groups ?? []).reduce((sum, g) => sum + g.pins.length, 0),
    [groups],
  );

  const main = (
    <div className="tp-global-map-shell" data-testid="global-map-page">
      <style>{SCOPED_STYLES}</style>
      <div ref={containerRef} className="tp-global-map-canvas" data-testid="global-map-canvas" />

      {(groups?.length ?? 0) > 0 && (
        <div className="tp-global-map-overlay" data-testid="global-map-overlay">
          <div className="tp-global-map-overlay-card">
            <h2>所有行程地圖</h2>
            <div className="tp-global-map-overlay-meta">
              {groups?.length ?? 0} 個行程 · {totalPins} 個地點 · 點顆色塊可隱藏該行程
            </div>
          </div>
          <div className="tp-global-map-chips" role="group" aria-label="行程顯示開關" data-testid="global-map-chips">
            {(groups ?? []).map((g) => {
              const visible = !hiddenTripIds.has(g.tripId);
              return (
                <button
                  key={g.tripId}
                  type="button"
                  className="tp-global-map-chip"
                  aria-pressed={visible}
                  onClick={() => toggleTrip(g.tripId)}
                  data-testid={`global-map-chip-${g.tripId}`}
                >
                  <span className="tp-global-map-chip-dot" style={{ background: g.color }} />
                  <span>{g.tripName}</span>
                  <span className="tp-global-map-chip-count">{g.pins.length}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!error && groups !== null && groups.length === 0 && (
        <div className="tp-global-map-empty">
          還沒有任何行程。先去 <a href="/trips" style={{ color: 'var(--color-accent)' }}>新增行程</a> 開始規劃。
        </div>
      )}

      {!error && groups !== null && groups.length > 0 && totalPins === 0 && (
        <div className="tp-global-map-empty">行程內還沒有任何 POI。先補景點到時間軸。</div>
      )}

      {error && (
        <div className="tp-global-map-empty" style={{ color: 'var(--color-destructive)' }}>{error}</div>
      )}

      {/* Mobile-only floating card surfaces selected POI when sheet is hidden */}
      <div
        className={`tp-global-map-mobile-card ${selected ? 'is-active' : ''}`}
        data-testid="global-map-mobile-card"
      >
        {selected && (
          <>
            <div className="tp-global-map-sheet-eyebrow">
              <span className="dot" style={{ background: selected.trip.color }} />
              <span>{selected.trip.tripName}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-headline)', marginBottom: 4 }}>
              {selected.pin.title}
            </div>
            {selected.pin.time && (
              <div style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-footnote)' }}>
                {selected.pin.time}
              </div>
            )}
            <a
              className="open-trip-btn"
              href={`/trips?selected=${encodeURIComponent(selected.trip.tripId)}`}
              style={{ marginTop: 10 }}
            >
              打開行程
            </a>
          </>
        )}
      </div>
    </div>
  );

  const sheet = (
    <div className="tp-global-map-sheet" data-testid="global-map-sheet">
      <style>{SCOPED_STYLES}</style>
      {selected ? (
        <>
          <div className="tp-global-map-sheet-eyebrow">
            <span className="dot" style={{ background: selected.trip.color }} />
            <span>{selected.trip.tripName}</span>
          </div>
          <h2>{selected.pin.title}</h2>
          <div className="meta">
            {selected.trip.countries && <span className="chip accent">{selected.trip.countries}</span>}
            {selected.pin.time && <span className="chip">{selected.pin.time}</span>}
            {typeof selected.pin.googleRating === 'number' && (
              <span className="chip">★ {selected.pin.googleRating.toFixed(1)}</span>
            )}
          </div>
          <div className="info-row">
            <span className="info-label">座標</span>
            <span>{selected.pin.lat.toFixed(4)}, {selected.pin.lng.toFixed(4)}</span>
          </div>
          {selected.pin.travelMin != null && (
            <div className="info-row">
              <span className="info-label">前一站交通</span>
              <span>{selected.pin.travelType ?? '—'} {selected.pin.travelMin} 分</span>
            </div>
          )}
          <a
            className="open-trip-btn"
            href={`/trips?selected=${encodeURIComponent(selected.trip.tripId)}`}
            data-testid="sheet-open-trip"
          >
            打開行程
          </a>
        </>
      ) : (
        <div className="tp-global-map-sheet-empty">
          點地圖上的標記查看景點細節。每個顏色代表一個行程。
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
