/**
 * TripMapRail — sticky right-column map for desktop ≥1024px.
 *
 * Thin wrapper around TpMap that adds:
 *   - Sticky positioning (≥1024px only, returns null below)
 *   - Scroll spy: when a day section ([data-day]) enters viewport 60%+, panTo that
 *     day's center without changing zoom
 *   - Pin click → navigate to /trip/:tripId/stop/:entryId
 *
 * The actual map rendering (tiles, pins, per-day colored polylines along real
 * roads via Mapbox Directions) is delegated to TpMap so desktop rail + mobile
 * MapPage share the same polyline engine and font stack.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lazyWithRetry } from '../../lib/lazyWithRetry';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { EVENT } from '../../lib/events';
import type { MapPin } from '../../hooks/useMapData';
import GooglePoiCard from './GooglePoiCard';
import type { GooglePoiClick } from '../../lib/mapHelpers';

const TpMap = lazyWithRetry(() => import('./TpMap'));

/* ===== Singleton style injection ===== */
function ensureStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.head.querySelector('[data-scope="trip-map-rail"]')) return;
  const el = document.createElement('style');
  el.setAttribute('data-scope', 'trip-map-rail');
  el.textContent = SCOPED_STYLES;
  document.head.appendChild(el);
}

interface TripMapRailProps {
  /** All pins from all days (pre-extracted by TripPage). */
  pins: MapPin[];
  /** Current trip ID — used for navigate to stop detail. */
  tripId: string;
  /** Group pins by day for polyline colouring. Key = dayNum. */
  pinsByDay?: Map<number, MapPin[]>;
  /** Pass through to TpMap — use dark tile layer when true. */
  dark?: boolean;
}

const SCOPED_STYLES = `
.trip-map-rail {
  /* ≥1024px breakpoint — iPad Pro 13" portrait start */
  position: sticky;
  top: var(--spacing-nav-h);
  height: calc(100dvh - var(--spacing-nav-h));
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-secondary);
}
.trip-map-rail > * {
  width: 100%;
  height: 100%;
}
/* item 2/3：Google POI 卡浮在地圖底部中央（同地圖頁 owner 2026-07-22「置中」）。
 * 選擇器比 .trip-map-rail 通用子代規則更 specific，覆蓋其 width/height:100%（否則卡片被撐滿整欄）。
 * .trip-map-rail 是 position:sticky，已建立定位包含塊，absolute 依它定位。 */
.trip-map-rail > .trip-map-rail-poi-card {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  width: min(340px, calc(100% - 24px));
  height: auto;
}
`;

export default function TripMapRail({ pins, tripId, pinsByDay, dark = false }: TripMapRailProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const navigate = useNavigate();
  const [panToCoord, setPanToCoord] = useState<{ lat: number; lng: number; zoom?: number } | undefined>();
  // v2.31.93：focusedEntryId 觸發 TpMap 換 marker 視覺（accent orange + 36px focused style）
  // + 內建 flyTo zoom 13 + collapse 自動 fitBounds（對齊 MapPage focusId flow）。
  const [focusedEntryId, setFocusedEntryId] = useState<number | undefined>();
  // #1140-followup item 2/3（owner 2026-07-24）：桌機行程頁地圖也能點 Google 原生 POI，
  // 點選後浮出 GooglePoiCard（同地圖頁 —— 店名 + 「在 Google 地圖開啟」另開分頁）。
  const [selectedGooglePoi, setSelectedGooglePoi] = useState<GooglePoiClick | null>(null);
  // #1140-followup item 1（owner「收合 stop 不要改變地圖定位，現在會移來移去」）：收合會讓時間軸
  // 版面位移，觸發下方 scroll-spy 的 IntersectionObserver 誤 pan 到別天中心。收合後短暫抑制
  // scroll-spy，讓地圖「原地不動」（展開仍飛過去，見 entryFocused handler）。
  const suppressScrollSpyUntilRef = useRef(0);

  useEffect(() => {
    ensureStyle();
  }, []);

  const handleMarkerClick = useCallback(
    (pinId: number) => {
      const pin = pins.find((p) => p.id === pinId);
      if (pin?.type === 'entry') {
        navigate(`/trip/${tripId}/stop/${pinId}`);
      }
    },
    [pins, tripId, navigate],
  );

  /* Scroll spy: pan map to the center of whichever day section is most in view.
     Computes centers up-front so the observer callback stays cheap. Averages over ALL pins
     (entries + hotel) to preserve pre-refactor behavior — hotel-only days still pan to hotel. */
  const dayCenters = useMemo(() => {
    const m = new Map<number, { lat: number; lng: number }>();
    if (!pinsByDay) return m;
    pinsByDay.forEach((dayPins, dayNum) => {
      if (dayPins.length === 0) return;
      const lat = dayPins.reduce((sum, p) => sum + p.lat, 0) / dayPins.length;
      const lng = dayPins.reduce((sum, p) => sum + p.lng, 0) / dayPins.length;
      m.set(dayNum, { lat, lng });
    });
    return m;
  }, [pinsByDay]);

  useEffect(() => {
    if (!isDesktop || dayCenters.size === 0) return;

    // v2.33.52 cleanup (round 6c defer): MutationObserver pattern — 之前
    // `querySelectorAll('[data-day]')` 在 mount 時 DaySection 可能還沒 commit
    // (lazy / loading 狀態)，observer 註冊到 0 個 target 永遠不再 fire。
    // 改：先掃，沒抓到 → MutationObserver 等 DOM 加 [data-day] 後 trigger。
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        // item 1：收合 stop 造成的版面位移會讓 observer 誤觸 → 抑制窗內不 pan（地圖原地不動）。
        if (performance.now() < suppressScrollSpyUntilRef.current) return;
        const mostVisible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.6)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!mostVisible) return;
        const dayNum = Number((mostVisible.target as HTMLElement).dataset.day);
        if (!Number.isFinite(dayNum)) return;
        const center = dayCenters.get(dayNum);
        if (center) setPanToCoord(center);
      },
      { threshold: [0.6, 0.8, 1.0] },
    );

    const observed = new WeakSet<HTMLElement>();
    function attachIfPresent(): boolean {
      const sections = document.querySelectorAll<HTMLElement>('[data-day]');
      let added = 0;
      sections.forEach((el) => {
        if (observed.has(el)) return;
        observed.add(el);
        intersectionObserver.observe(el);
        added += 1;
      });
      return added > 0;
    }

    const initiallyFound = attachIfPresent();
    let mutationObserver: MutationObserver | null = null;
    if (!initiallyFound) {
      // Watch for DaySection mount — observe document.body 直到首批 attach 成功。
      mutationObserver = new MutationObserver(() => {
        if (attachIfPresent()) {
          mutationObserver?.disconnect();
          mutationObserver = null;
        }
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      intersectionObserver.disconnect();
      mutationObserver?.disconnect();
    };
  }, [isDesktop, dayCenters]);

  // v2.31.81 #5：TimelineRail row click → dispatch entryFocused → pan map to pin。
  // v2.31.93：對齊 MapPage focusId flow — 不再 manual panToCoord+zoom，改用
  //   focusedEntryId 觸發 TpMap useEffect 同時切 marker 視覺（accent orange + 36px）
  //   + flyTo z<12?13:undefined + collapse 自動 fitBounds(visible pins) 回 overview。
  //   - 展開 (isExpanding=true) → setFocusedEntryId(entryId) → flyTo 該 stop
  //   - 收合 (isExpanding=false) → 只解除 marker focus，**不動地圖視野**（item 1，見下）
  //   - undefined (scroll spy fallback) → 維持 v2.31.81 panToCoord pan only no zoom
  useEffect(() => {
    if (!isDesktop) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ entryId?: number; isExpanding?: boolean }>).detail;
      const entryId = detail?.entryId;
      if (typeof entryId !== 'number') return;
      const pin = pins.find((p) => p.id === entryId);
      if (!pin) return;
      if (detail?.isExpanding === true) {
        setFocusedEntryId(entryId);
        setPanToCoord(undefined);
        setSelectedGooglePoi(null); // 聚焦行程 stop 時清掉 Google POI 卡（互斥，同地圖頁）
      } else if (detail?.isExpanding === false) {
        // item 1「收合原地不動」：解除 marker focus（focusId=undefined，因 fitOnce 已完成 → 不 fitBounds、
        // 地圖不動），但收合的版面位移會讓 scroll-spy 誤 pan → 短暫抑制它（見 observer callback）。
        setFocusedEntryId(undefined);
        setPanToCoord(undefined);
        suppressScrollSpyUntilRef.current = performance.now() + 600;
      } else {
        setPanToCoord({ lat: pin.lat, lng: pin.lng });
      }
    };
    window.addEventListener(EVENT.entryFocused, handler);
    return () => window.removeEventListener(EVENT.entryFocused, handler);
  }, [isDesktop, pins]);

  if (!isDesktop) return null;

  return (
    <div className="trip-map-rail">
      <Suspense fallback={<div />}>
        <TpMap
          pins={pins}
          mode="overview"
          pinsByDay={pinsByDay}
          routes={true}
          fillParent={true}
          fitOnce={true}
          onMarkerClick={handleMarkerClick}
          onPoiClick={(poi) => {
            // item 2/3：點 Google 原生 POI → 浮出 POI 卡；與行程 stop focus 互斥（同地圖頁）。
            setSelectedGooglePoi(poi);
            setFocusedEntryId(undefined);
          }}
          onMapClick={() => setSelectedGooglePoi(null)}
          panToCoord={panToCoord}
          focusId={focusedEntryId}
          dark={dark}
        />
      </Suspense>
      {selectedGooglePoi && (
        <div className="trip-map-rail-poi-card">
          <GooglePoiCard poi={selectedGooglePoi} onClose={() => setSelectedGooglePoi(null)} />
        </div>
      )}
    </div>
  );
}
