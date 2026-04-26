/**
 * GlobalMapPage — V2 全域地圖（mockup-map-v2.html 對齊，user-revised）
 *
 * Route: /map
 *
 * Design deviation from mockup: mockup 顯示所有 trip 同時 + filter chips；
 * user 指示改成「挑一個 trip 顯示 + dropdown 切換 + 沒 trip → 新增行程 CTA」。
 *
 * Layout:
 *   - Desktop ≥1024px: 3-pane (sidebar | map main | sheet POI detail)
 *   - Mobile <1024px: 1-pane map + bottom POI carousel + bottom nav
 *
 * Map render:
 *   - 重用 `OceanMap mode="overview"` — 內建 useRoute 走 /api/route
 *     proxy（Mapbox driving directions），落地真實導航折線而不是直線。
 *   - Per-day polyline 按 dayColor(N)，hotel sortOrder=-1 入線（DESIGN.md
 *     「地圖 Polyline 規格」）。
 *   - 點 marker → setSelected → 右側 sheet 顯示 POI detail，flyTo 該 pin。
 *   - 點 cluster → supercluster.getClusterExpansionZoom 自動 zoom 展開（OceanMap 內處理）。
 *   - 透過 onMapReady 拿 L.Map 實例，給「全覽 / 我的位置」pill button 用。
 *
 * Sheet（mockup-map-v2 對齊）：
 *   - Header: ✕ close（清掉 selectedPinId）+ 跳到行程 accent CTA
 *   - Body: trip dot eyebrow + POI title + meta chips → 同日其他 stop mini-list（active 高亮）
 *   - Empty state: 提示點 marker
 *
 * Mobile（mockup-map-v2 對齊）：
 *   - Bottom POI carousel — active 那天的所有 stops，左右滑換，點 card → setSelected
 *   - 取代之前的單一浮動 card
 *
 * Empty state: 沒任何 trip → terracotta hero + 「+ 新增行程」按鈕走
 * useNewTrip().openModal。
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type L from 'leaflet';
import { Link } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useDarkMode } from '../hooks/useDarkMode';
import { useNewTrip } from '../contexts/NewTripContext';
import { extractPinsFromDay, type MapPin } from '../hooks/useMapData';
import { dayColor } from '../lib/dayPalette';
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

/* Header — trip switcher.
 * z-index 1000 確保壓過 leaflet marker pane (z-index 600+) 跟 popup pane (700+)。
 * 之前 z-index 20 被 leaflet cluster icon (drawn inside map container 但
 * 因 stacking context 計算出更高) 壓在下面。 */
.tp-global-map-header {
  position: absolute; top: 16px; left: 16px;
  z-index: 1000;
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
.tp-global-map-trip-btn .caret {
  /* QA 2026-04-26 BUG-041/047：12px caret 跟 muted color 太弱，user 看不出
   * 是 dropdown。bump 14 + 改 accent color，視覺重量出來，affordance 清楚 */
  font-size: 14px; color: var(--color-accent); flex-shrink: 0; font-weight: 700;
}
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
  z-index: 1001;
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

/* 全覽 / 我的位置 pill bar — 對齊 mockup-map-v2 .map-action-bar (bottom-left).
 * z-index 600 floats above leaflet panes，避開 marker click 區。
 * Mobile 下放在 bottom carousel 上方，避免被 carousel 遮擋。 */
.tp-global-map-actions {
  position: absolute; bottom: 24px; left: 24px;
  display: flex; gap: 8px;
  z-index: 600;
}
@media (max-width: 1023px) {
  /* QA 2026-04-26 PR-I：carousel 拿掉 eyebrow + title 後高度從 ~150 → ~100，
   * pill bar 從 240 → 130 往下方 stop 切換靠攏（per user feedback）。 */
  .tp-global-map-actions {
    bottom: 130px; left: 12px;
  }
}
.tp-global-map-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 14px; border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-background) 95%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--color-border);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-foreground); cursor: pointer;
  box-shadow: var(--shadow-sm);
  min-height: var(--spacing-tap-min);
}
.tp-global-map-pill:hover {
  background: var(--color-background);
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.tp-global-map-pill:disabled {
  opacity: 0.5; cursor: not-allowed;
}
.tp-global-map-pill .svg-icon { width: 14px; height: 14px; }

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

/* ===== Sheet (desktop right pane) — mockup-map-v2 對齊 =====
 * Header 帶 ✕ close + 跳到行程 accent button。
 * Body: trip dot eyebrow → title → meta chips → info-rows → 同日其他 stop。 */
.tp-global-map-sheet {
  display: flex; flex-direction: column;
  height: 100%;
}
.tp-global-map-sheet-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}
.tp-global-map-sheet-header .icon-btn {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  display: grid; place-items: center; cursor: pointer;
  color: var(--color-muted);
  font: inherit;
}
.tp-global-map-sheet-header .icon-btn:hover {
  border-color: var(--color-accent); color: var(--color-accent);
}
.tp-global-map-sheet-header .spacer { flex: 1; }
.tp-global-map-sheet-header .open-trip-btn {
  display: inline-flex; align-items: center;
  padding: 6px 14px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  text-decoration: none;
  font: inherit; font-size: var(--font-size-footnote); font-weight: 700;
  border: none; cursor: pointer;
}
.tp-global-map-sheet-header .open-trip-btn:hover { filter: brightness(var(--hover-brightness)); }
.tp-global-map-sheet-body {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 20px;
}
.tp-global-map-sheet-empty {
  display: grid; place-items: center;
  height: 100%;
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  line-height: 1.55;
  text-align: center;
  padding: 24px;
}

/* QA 2026-04-26 BUG-044/045：no-pin selected 時 sheet 不再 99% 空白，
 * 改顯示 trip overview — trip 名 + total stops/days + 各 day 列表 + 第一站
 * preview。每個 day row click → setSelectedPinId 到該天第一個 pin。 */
.tp-global-map-sheet-overview { display: flex; flex-direction: column; gap: 16px; }
.tp-global-map-sheet-overview-header h2 {
  font-size: var(--font-size-title2); font-weight: 800;
  letter-spacing: -0.01em; margin: 0 0 4px;
}
.tp-global-map-sheet-overview-header p {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  margin: 0; font-variant-numeric: tabular-nums;
}
.tp-global-map-sheet-overview-days {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 6px;
}
.tp-global-map-sheet-day-btn {
  display: flex; align-items: center; gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-background); cursor: pointer;
  font: inherit; text-align: left;
  min-height: var(--spacing-tap-min);
  transition: border-color 120ms, background 120ms;
}
.tp-global-map-sheet-day-btn:hover {
  border-color: var(--color-accent); background: var(--color-accent-subtle);
}
.tp-global-map-sheet-day-num {
  width: 28px; height: 28px; border-radius: var(--radius-full);
  display: grid; place-items: center;
  color: #fff; font-weight: 700; font-size: var(--font-size-caption);
  flex-shrink: 0;
}
.tp-global-map-sheet-day-text { flex: 1; min-width: 0; }
.tp-global-map-sheet-day-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}
.tp-global-map-sheet-day-first {
  font-size: var(--font-size-callout); font-weight: 600;
  color: var(--color-foreground); margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tp-global-map-sheet-hint {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  text-align: center; margin: 12px 0 0; line-height: 1.5;
  padding: 12px; background: var(--color-secondary); border-radius: var(--radius-md);
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
.tp-global-map-sheet-title {
  font-size: var(--font-size-title2); font-weight: 800;
  letter-spacing: -0.01em; margin: 0 0 10px;
  line-height: 1.25;
}
.tp-global-map-sheet-meta {
  display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px;
}
.tp-global-map-sheet-meta .chip {
  display: inline-flex; padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption); font-weight: 600;
  background: var(--color-tertiary); color: var(--color-muted);
  letter-spacing: 0.04em;
}
.tp-global-map-sheet-meta .chip.accent {
  background: var(--color-accent-subtle); color: var(--color-accent);
}
.tp-global-map-sheet-meta .chip.rating {
  color: var(--color-foreground); font-weight: 700;
}
.tp-global-map-sheet-section {
  margin-top: 20px; padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.tp-global-map-sheet-section h4 {
  font-size: var(--font-size-caption2); font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted);
  margin: 0 0 8px;
}
.tp-global-map-sheet-section .info-row {
  display: flex; align-items: baseline; gap: 8px;
  font-size: var(--font-size-footnote);
  padding: 6px 0;
  border-bottom: 1px dashed var(--color-border);
}
.tp-global-map-sheet-section .info-row:last-child { border-bottom: none; }
.tp-global-map-sheet-section .info-row .info-label {
  font-size: var(--font-size-caption2); font-weight: 700; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--color-muted);
  width: 80px; flex-shrink: 0;
}
.tp-global-map-sheet-section .info-row .info-value {
  color: var(--color-foreground);
  font-variant-numeric: tabular-nums;
}

/* 同日其他 stop mini-list */
.tp-global-map-sheet-stops {
  display: flex; flex-direction: column;
}
.tp-global-map-sheet-stop {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--color-border);
  cursor: pointer;
  background: transparent; border-left: none; border-right: none; border-top: none;
  font: inherit; text-align: left;
  width: 100%;
  color: var(--color-foreground);
}
.tp-global-map-sheet-stop:last-child { border-bottom: none; }
.tp-global-map-sheet-stop:hover .ds-name { color: var(--color-accent-deep); }
.tp-global-map-sheet-stop .ds-time {
  font-size: var(--font-size-caption); font-weight: 700;
  font-variant-numeric: tabular-nums;
  width: 44px; flex-shrink: 0;
}
.tp-global-map-sheet-stop .ds-dot {
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--color-background);
  border: 1.5px solid var(--color-line-strong);
  display: grid; place-items: center;
  font-size: 9px; font-weight: 700;
  color: var(--color-muted);
  flex-shrink: 0;
}
.tp-global-map-sheet-stop.is-active .ds-dot {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-foreground);
}
.tp-global-map-sheet-stop .ds-name {
  font-size: var(--font-size-footnote); font-weight: 500;
  flex: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tp-global-map-sheet-stop.is-active .ds-name {
  font-weight: 700; color: var(--color-accent-deep);
}

/* ===== Mobile bottom POI carousel — mockup-map-v2 .mobile-poi-stack 對齊 ===== */
.tp-global-map-mobile-stack {
  position: absolute; left: 0; right: 0; bottom: 0;
  background: linear-gradient(to top, var(--color-background) 75%, transparent);
  padding: 12px 0 16px;
  /* z-index 700 浮在 leaflet marker-pane (600) + tooltip-pane (650) 之上，
   * 只低於 popup-pane (700)，跟「全覽/我的位置」pill bar (600) 不衝突。 */
  z-index: 700;
  display: none;
  pointer-events: auto;
}
@media (max-width: 1023px) {
  .tp-global-map-mobile-stack { display: block; }
}
.tp-global-map-mobile-handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: var(--color-line-strong);
  margin: 0 auto 8px;
}
.tp-global-map-mobile-eyebrow {
  display: flex; align-items: center; gap: 6px;
  padding: 0 16px;
  font-size: var(--font-size-eyebrow); font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--color-muted);
  margin-bottom: 4px;
}
.tp-global-map-mobile-eyebrow .dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-accent);
}
.tp-global-map-mobile-title {
  padding: 0 16px;
  font-size: var(--font-size-footnote); font-weight: 700;
  margin-bottom: 8px;
  color: var(--color-foreground);
}
.tp-global-map-mobile-cards {
  display: flex; gap: 10px;
  padding: 4px 16px;
  overflow-x: auto;
  scrollbar-width: none;
  scroll-snap-type: x mandatory;
  /* QA 2026-04-26 BUG-039：右側 28px gradient mask 暗示「還有 stop 可滑」。
   * 比照 PR-A DayNav 同 pattern。padding-right 給 24px 防 mask 蓋到 last card 內容 */
  -webkit-mask-image: linear-gradient(to right, black calc(100% - 28px), transparent 100%);
  mask-image: linear-gradient(to right, black calc(100% - 28px), transparent 100%);
}
.tp-global-map-mobile-cards::-webkit-scrollbar { display: none; }
.tp-global-map-mobile-card {
  flex: 0 0 150px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  cursor: pointer;
  text-align: left;
  font: inherit;
  scroll-snap-align: start;
  display: flex; flex-direction: column;
}
.tp-global-map-mobile-card:hover {
  border-color: var(--color-accent);
}
.tp-global-map-mobile-card.is-active {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
}
.tp-global-map-mobile-card .pc-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--color-muted);
  margin-bottom: 2px;
  font-variant-numeric: tabular-nums;
}
.tp-global-map-mobile-card .pc-title {
  font-size: var(--font-size-caption); font-weight: 600;
  line-height: 1.3;
  color: var(--color-foreground);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  const mapRef = useRef<L.Map | null>(null);

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

  const onMapReady = useCallback((map: L.Map | null) => {
    mapRef.current = map;
  }, []);

  const pickTrip = useCallback((tripId: string) => {
    setActiveTripId(tripId);
    lsSet(LS_KEY_TRIP_PREF, tripId);
    setMenuOpen(false);
    setSelectedPinId(null);
  }, []);

  const closeSheet = useCallback(() => {
    setSelectedPinId(null);
  }, []);

  // 全覽 — fitBounds 到所有 pins。
  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || !resolved || resolved.pins.length === 0) return;
    const latlngs = resolved.pins.map((p) => [p.lat, p.lng] as [number, number]);
    map.fitBounds(latlngs, { padding: [40, 40] });
  }, [resolved]);

  // 我的位置 — navigator.geolocation 取座標 → flyTo。
  // 失敗（denied / unsupported）silent fail，pill button 也不丟錯，只是不動作。
  const locateMe = useCallback(() => {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 14, { animate: true });
      },
      () => {
        // permission denied / unavailable — silent
      },
      { timeout: 5000, maximumAge: 60000 },
    );
  }, []);

  const selectedPin = useMemo(() => {
    if (!resolved || selectedPinId == null) return null;
    return resolved.pins.find((p) => p.id === selectedPinId) ?? null;
  }, [resolved, selectedPinId]);

  // 算 selected pin 在哪天 → 從 pinsByDay 反查（O(days) 通常 < 30）
  const selectedDay = useMemo(() => {
    if (!resolved || !selectedPin) return null;
    for (const [dayNum, dayPins] of resolved.pinsByDay) {
      if (dayPins.some((p) => p.id === selectedPin.id)) return { dayNum, pins: dayPins };
    }
    return null;
  }, [resolved, selectedPin]);

  // PR-I：原 carouselDay (filter to one day) 移除 — carousel 改 cross-day
  // continuous，render 全部 pins 直接從 resolved.pinsByDay 攤平。selectedDay
  // 仍由其他地方使用（map flyTo 範圍）。

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
          {/* QA 2026-04-26 PR-I：簡化 header — 拿掉「Global Map」 eyebrow + stops/days
           * meta，只留 trip dropdown。資訊在 sheet overview 已重複顯示。 */}
          {trips && trips.length > 0 && (
            <div className="tp-global-map-header" ref={menuRef} data-testid="global-map-trip-switcher">
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
                  onMapReady={onMapReady}
                  zoomControlPosition="bottomright"
                  dark={isDark}
                  className="ocean-map-container"
                  /* QA 2026-04-26 PR-I 更正：完全停用 cluster — user feedback「移除
                   * cluster」。每個 stop 直接顯示為個別 pin，不再 cluster 成數字 bubble。 */
                  cluster={false}
                />
              </Suspense>
            )}
            {error && (
              <div className="tp-global-map-loading" style={{ color: 'var(--color-destructive)' }}>{error}</div>
            )}

            {/* Bottom-left action pills — 全覽 / 我的位置 (mockup .map-action-bar) */}
            {resolved && resolved.pins.length > 0 && (
              <div className="tp-global-map-actions" data-testid="global-map-actions">
                <button
                  type="button"
                  className="tp-global-map-pill"
                  onClick={fitAll}
                  data-testid="global-map-fit-all"
                  aria-label="把所有景點縮成一個畫面"
                >
                  <Icon name="map" />
                  <span>全覽</span>
                </button>
                <button
                  type="button"
                  className="tp-global-map-pill"
                  onClick={locateMe}
                  data-testid="global-map-locate-me"
                  aria-label="移到我目前的位置"
                >
                  <Icon name="location-pin" />
                  <span>我的位置</span>
                </button>
              </div>
            )}

            {/* QA 2026-04-26 PR-I：mobile carousel 三大改動
             *   1. 拿掉 eyebrow + title row（標題重複，user 已從 header 看到 trip 名）
             *   2. cross-day 連續 scroll — flatten pinsByDay 成單一陣列
             *      Day 1 最後 stop → Day 2 第一 stop 直接接續滑換
             *   3. active card border-color 用 dayColor(dayNum)，跟 map polyline 一致 */}
            {resolved && resolved.pins.length > 0 && (
              <div className="tp-global-map-mobile-stack" data-testid="global-map-mobile-stack">
                <div className="tp-global-map-mobile-handle" aria-hidden="true" />
                <div className="tp-global-map-mobile-cards">
                  {Array.from(resolved.pinsByDay.entries())
                    .sort((a, b) => a[0] - b[0])
                    .flatMap(([dayNum, pins]) => pins.map((pin) => ({ pin, dayNum })))
                    .map(({ pin, dayNum }) => {
                      const isActive = pin.id === selectedPinId;
                      const dColor = dayColor(dayNum);
                      return (
                        <button
                          key={pin.id}
                          type="button"
                          className={`tp-global-map-mobile-card ${isActive ? 'is-active' : ''}`}
                          onClick={() => setSelectedPinId(pin.id)}
                          data-testid={`global-map-mobile-card-${pin.id}`}
                          style={isActive ? { borderColor: dColor, boxShadow: `0 0 0 2px ${dColor}33` } : { borderLeftColor: dColor, borderLeftWidth: 3 }}
                        >
                          <div className="pc-eyebrow">
                            {pin.time ? `${pin.time} · D${dayNum}·${pin.index || '—'}` : `D${dayNum}·STOP ${pin.index || '—'}`}
                          </div>
                          <div className="pc-title" title={pin.title}>{pin.title}</div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  // Desktop right sheet — mockup-map-v2 對齊：✕ close + 跳到行程 button + meta chips + info-rows + 同日 mini-list
  const sheet = (
    <div className="tp-global-map-sheet" data-testid="global-map-sheet">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-global-map-sheet-header">
        <button
          type="button"
          className="icon-btn"
          onClick={closeSheet}
          disabled={!selectedPin}
          aria-label="關閉景點細節"
          data-testid="global-map-sheet-close"
        >
          ✕
        </button>
        <div className="spacer" />
        {selectedPin && resolved && (
          <Link
            to={`/trips?selected=${encodeURIComponent(resolved.tripId)}`}
            className="open-trip-btn"
            data-testid="global-map-sheet-open-trip"
          >
            跳到行程
          </Link>
        )}
      </div>
      <div className="tp-global-map-sheet-body">
        {selectedPin && resolved ? (
          <>
            <div className="tp-global-map-sheet-eyebrow">
              <span className="dot" />
              <span>
                {resolved.name}
                {selectedDay && ` · Day ${String(selectedDay.dayNum).padStart(2, '0')}`}
                {selectedPin.index > 0 && ` · Stop ${String(selectedPin.index).padStart(2, '0')}`}
              </span>
            </div>
            <h2 className="tp-global-map-sheet-title">{selectedPin.title}</h2>
            <div className="tp-global-map-sheet-meta">
              {resolved.countries && <span className="chip accent">{resolved.countries}</span>}
              {selectedPin.type === 'hotel' && <span className="chip">住宿</span>}
              {selectedPin.time && <span className="chip">{selectedPin.time}</span>}
              {typeof selectedPin.googleRating === 'number' && (
                <span className="chip rating">★ {selectedPin.googleRating.toFixed(1)}</span>
              )}
            </div>

            <div className="tp-global-map-sheet-section">
              <h4>資訊</h4>
              <div className="info-row">
                <span className="info-label">座標</span>
                <span className="info-value">{selectedPin.lat.toFixed(4)}, {selectedPin.lng.toFixed(4)}</span>
              </div>
              {selectedPin.travelMin != null && (
                <div className="info-row">
                  <span className="info-label">前段交通</span>
                  <span className="info-value">{selectedPin.travelType ?? '—'} · {selectedPin.travelMin} 分</span>
                </div>
              )}
            </div>

            {selectedDay && selectedDay.pins.length > 1 && (
              <div className="tp-global-map-sheet-section">
                <h4>同日其他 stop</h4>
                <div className="tp-global-map-sheet-stops">
                  {selectedDay.pins.map((p) => {
                    const active = p.id === selectedPin.id;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        className={`tp-global-map-sheet-stop ${active ? 'is-active' : ''}`}
                        onClick={() => setSelectedPinId(p.id)}
                        data-testid={`global-map-sheet-stop-${p.id}`}
                      >
                        <span className="ds-time">{p.time ?? '—'}</span>
                        <span className="ds-dot">{p.type === 'hotel' ? '🛏' : (p.index || '·')}</span>
                        <span className="ds-name">{p.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : resolved ? (
          /* QA 2026-04-26 BUG-044/045：no pin selected 時不再 99% 空白，改顯
           * 示 trip overview — name + meta + day list (click 首 pin)。 */
          <div className="tp-global-map-sheet-overview" data-testid="global-map-sheet-overview">
            <div className="tp-global-map-sheet-overview-header">
              <h2>{resolved.name}</h2>
              <p>{resolved.pins.length} stops · {resolved.pinsByDay.size} days</p>
            </div>
            <ul className="tp-global-map-sheet-overview-days">
              {Array.from(resolved.pinsByDay.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([dayNum, pins]) => {
                  const firstPin = pins[0];
                  if (!firstPin) return null;
                  return (
                    <li key={dayNum}>
                      <button
                        type="button"
                        className="tp-global-map-sheet-day-btn"
                        onClick={() => setSelectedPinId(firstPin.id)}
                        data-testid={`global-map-sheet-day-${dayNum}`}
                      >
                        <span
                          className="tp-global-map-sheet-day-num"
                          style={{ background: dayColor(dayNum) }}
                          aria-hidden="true"
                        >
                          {dayNum}
                        </span>
                        <span className="tp-global-map-sheet-day-text">
                          <span className="tp-global-map-sheet-day-eyebrow">
                            DAY {String(dayNum).padStart(2, '0')} · {pins.length} stops
                          </span>
                          <span className="tp-global-map-sheet-day-first">
                            {firstPin.title}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
            <p className="tp-global-map-sheet-hint">
              點地圖上的 marker 看單一景點詳情，線段是真實導航路線
            </p>
          </div>
        ) : (
          <div className="tp-global-map-sheet-empty">
            {hasNoTrips
              ? '左側建立第一個行程後，地圖會用真實導航路線把每個景點串起來。'
              : '挑一個行程來看地圖。'}
          </div>
        )}
      </div>
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
