/**
 * DayMap — 單天互動地圖元件
 *
 * F002：基礎 Google Maps 渲染 + 收合/展開 + 所有狀態處理
 * F003：MapMarker + InfoWindow + Timeline 雙向聯動
 * - Loading skeleton（SDK 載入中）
 * - Empty state（無座標景點）
 * - Error fallback（SDK 載入失敗）
 * - Partial warning（部分景點缺少座標）
 * - Success（地圖渲染 + markers）
 *
 * 使用 React.lazy + Suspense code-split（由 TripPage 管理）。
 * 收合狀態存 localStorage，key: map-collapsed。
 *
 * 雙向聯動：
 * - 點擊 marker → scroll Timeline 到對應 entry（data-entry-id 屬性）
 * - 點擊 Timeline entry（透過自訂 event）→ pan 地圖到對應 marker 並 highlight
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { useMapData } from '../../hooks/useMapData';
import { lsGet, lsSet } from '../../lib/localStorage';
import Icon from '../shared/Icon';
import { MapMarker } from './MapMarker';
import { MapRoute } from './MapRoute';
import { useDirectionsRoute } from '../../hooks/useDirectionsRoute';
import type { Day } from '../../types/trip';
import { GOOGLE_MAPS_URL_BASE } from '../../lib/constants';

/* ===== Constants ===== */

export const LS_KEY_MAP_COLLAPSED = 'map-collapsed';

/* ===== Custom event for Timeline → map bidirectional communication ===== */
/** Timeline entry 點擊時發出的自訂事件 */
export const MAP_FOCUS_EVENT = 'tp:map-focus-entry';

/* ===== Props ===== */

interface DayMapProps {
  day: Day | null | undefined;
  dayNum: number;
}

/* ===== Helper: build fallback Google Maps search URL ===== */

function buildFallbackUrl(dayNum: number): string {
  return `${GOOGLE_MAPS_URL_BASE}?api=1&query=day+${dayNum}+sightseeing`;
}

/* ===== Helper: scroll Timeline to entry ===== */

function scrollToEntry(entryId: number, timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>): void {
  const el = document.querySelector(`[data-entry-id="${entryId}"]`);
  if (!el) return;

  /* highlight 效果 */
  el.classList.add('map-highlight');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  /* 清除前一個 timeout，避免多次點擊殘留 */
  if (timeoutRef.current !== null) {
    clearTimeout(timeoutRef.current);
  }
  timeoutRef.current = setTimeout(() => {
    el.classList.remove('map-highlight');
    timeoutRef.current = null;
  }, 2000);
}

/* ===== Component ===== */

export default function DayMap({ day, dayNum }: DayMapProps) {
  const { status, error } = useGoogleMaps();
  const { pins, missingCount, hasData } = useMapData(day);

  /* --- 收合狀態：預設展開，localStorage 持久化 --- */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const saved = lsGet<boolean>(LS_KEY_MAP_COLLAPSED);
    return saved === true;
  });

  const handleToggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      lsSet(LS_KEY_MAP_COLLAPSED, next);
      return next;
    });
  }, []);

  /* --- 地圖 DOM ref --- */
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  /** 地圖 instance 是否就緒（用 state 觸發 re-render，不用 ref）*/
  const [mapReady, setMapReady] = useState(false);

  /** click listener handle，用於 unmount 時 remove */
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  /** highlight setTimeout ID，用於 unmount 時 clearTimeout */
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* --- 選中的 marker ID (F003 雙向聯動) --- */
  const [activePinId, setActivePinId] = useState<number | null>(null);

  /* --- Directions API 路線（F006） --- */
  const { routePath, legMidpoints, loading: routeLoading } = useDirectionsRoute(
    pins,
    !collapsed && mapReady && pins.length >= 2,
  );

  /* --- 地圖初始化 --- */
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !hasData) return;
    if (mapInstanceRef.current) return; // 已初始化

    const center = { lat: pins[0].lat, lng: pins[0].lng };
    const mapEl = mapRef.current;

    const map = new google.maps.Map(mapEl, {
      center,
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM,
      },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
    });

    mapInstanceRef.current = map;

    /* --- fitBounds：自動縮放包含所有 pins --- */
    if (pins.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      for (const pin of pins) {
        bounds.extend({ lat: pin.lat, lng: pin.lng });
      }
      map.fitBounds(bounds, 40); // 40px padding
    }

    /* --- 點擊地圖空白處關閉選中：存 listener handle 以便 cleanup --- */
    clickListenerRef.current = map.addListener('click', () => {
      setActivePinId(null);
    });

    /* --- 地圖就緒，觸發 re-render 讓 MapMarker / MapRoute 得以掛載 --- */
    setMapReady(true);
  }, [status, hasData, pins]);

  /* --- Timeline → marker 聯動：監聽自訂事件 --- */
  useEffect(() => {
    function handleFocusEntry(e: Event) {
      const detail = (e as CustomEvent<{ entryId: number }>).detail;
      if (!detail?.entryId) return;

      const pin = pins.find((p) => p.id === detail.entryId);
      if (!pin || !mapInstanceRef.current) return;

      /* pan 地圖到 marker 位置 */
      mapInstanceRef.current.panTo({ lat: pin.lat, lng: pin.lng });

      /* highlight marker */
      setActivePinId(pin.id);
    }

    document.addEventListener(MAP_FOCUS_EVENT, handleFocusEntry);
    return () => {
      document.removeEventListener(MAP_FOCUS_EVENT, handleFocusEntry);
    };
  }, [pins]);

  /* --- Marker 點擊：選中 + pan --- */
  const handleMarkerSelect = useCallback((pinId: number) => {
    setActivePinId(pinId);
    const pin = pins.find((p) => p.id === pinId);
    if (pin && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: pin.lat, lng: pin.lng });
    }
  }, [pins]);

  /* --- InfoWindow「滾到此處」點擊 --- */
  const handleScrollToEntry = useCallback((entryId: number) => {
    scrollToEntry(entryId, highlightTimeoutRef);
  }, []);

  /* --- 地圖 instance cleanup --- */
  useEffect(() => {
    return () => {
      /* 移除 map click listener */
      if (clickListenerRef.current) {
        clickListenerRef.current.remove();
        clickListenerRef.current = null;
      }
      /* 清除 highlight timeout */
      if (highlightTimeoutRef.current !== null) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      mapInstanceRef.current = null;
      setMapReady(false);
    };
  }, []);

  /* ===== Render ===== */

  const mapId = `day-map-${dayNum}`;

  return (
    <div data-testid="day-map-section">
      {/* Header：標籤 + 收合按鈕 */}
      <div className="flex items-center justify-between p-2 px-1 mb-2">
        <span className="text-footnote font-semibold text-muted uppercase tracking-[0.04em]">
          <Icon name="map" />
          動線地圖
        </span>
        <button
          className="flex items-center gap-2 py-2 px-4 bg-transparent rounded-sm text-muted text-footnote font-medium cursor-pointer min-h-tap-min min-w-[var(--spacing-tap-min)] transition-colors duration-fast ease-apple hover:text-foreground hover:bg-tertiary"
          aria-expanded={!collapsed}
          aria-controls={mapId}
          onClick={handleToggle}
          type="button"
        >
          <Icon name={collapsed ? 'expand-more' : 'expand-less'} />
          {collapsed ? '展開地圖' : '收合地圖'}
        </button>
      </div>

      {/* 地圖主體：收合/展開動畫 */}
      <div
        id={mapId}
        role="region"
        aria-label={`第 ${dayNum} 天動線地圖`}
        className={clsx(
          'overflow-hidden transition-[max-height] duration-normal ease-apple',
          collapsed ? 'max-h-0' : 'max-h-[420px] md:max-h-[460px] lg:max-h-[520px]',
        )}
        aria-hidden={collapsed}
      >
        {/* Case 1：SDK 載入中 → skeleton */}
        {status === 'loading' || status === 'idle' ? (
          <div
            className="h-[250px] md:h-[300px] lg:h-[350px] bg-tertiary rounded-md animate-pulse"
            role="status"
            aria-label="地圖載入中"
            data-testid="day-map-skeleton"
          />
        ) : null}

        {/* Case 2：SDK 載入失敗 → error fallback */}
        {status === 'error' ? (
          <div
            className="flex flex-col items-center justify-center gap-3 p-8 bg-secondary rounded-md h-[250px] md:h-[300px] lg:h-[350px] text-center"
            role="alert"
            data-testid="day-map-error"
          >
            <Icon name="warning" />
            <p className="text-subheadline font-semibold text-foreground">地圖無法載入</p>
            <p className="text-footnote text-muted">
              {error ?? 'Google Maps SDK 無法載入，請確認網路連線。'}
            </p>
            <a
              className="inline-flex items-center gap-2 py-2 px-4 bg-accent text-accent-foreground rounded-sm text-footnote font-semibold no-underline min-h-tap-min min-w-[var(--spacing-tap-min)] justify-center"
              href={buildFallbackUrl(dayNum)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`在 Google Maps 中查看第 ${dayNum} 天行程`}
            >
              <Icon name="map" />
              前往 Google Maps
            </a>
          </div>
        ) : null}

        {/* Case 3：SDK ready + 無座標資料 → empty state */}
        {status === 'ready' && !hasData ? (
          <div
            className="flex items-center justify-center h-[250px] md:h-[300px] lg:h-[350px] bg-secondary rounded-md text-footnote text-muted text-center p-4"
            data-testid="day-map-empty"
          >
            今天沒有排程景點座標
          </div>
        ) : null}

        {/* Case 4：SDK ready + 有資料 → 地圖容器 + markers */}
        {status === 'ready' && hasData ? (
          <div className="relative touch-none bg-secondary rounded-md overflow-hidden" data-testid="day-map-container">
            <div
              ref={mapRef}
              className="h-[250px] md:h-[300px] lg:h-[350px] w-full rounded-md"
              aria-label={`第 ${dayNum} 天互動地圖`}
              data-testid="day-map-canvas"
            />

            {/* MapMarkers（F003）：只在地圖 instance 就緒時渲染（mapReady 是 state，可觸發 re-render）*/}
            {mapReady && pins.map((pin) => (
              <MapMarker
                key={pin.id}
                map={mapInstanceRef.current!}
                pin={pin}
                isSelected={activePinId === pin.id}
                onSelect={handleMarkerSelect}
                onScrollToEntry={handleScrollToEntry}
              />
            ))}

            {/* MapRoute（F006）：Directions API 實際道路路線 */}
            {mapReady && pins.length >= 2 && (
              <MapRoute
                map={mapInstanceRef.current!}
                pins={pins}
                routePath={routePath}
                legMidpoints={legMidpoints}
                routeLoading={routeLoading}
              />
            )}
          </div>
        ) : null}
      </div>

      {/* 部分座標缺失提示條（展開時顯示） */}
      {!collapsed && status === 'ready' && missingCount > 0 && (
        <div
          className="flex items-center gap-2 py-2 px-3 bg-accent-subtle rounded-sm text-caption text-muted mt-2"
          role="status"
          data-testid="day-map-warning"
        >
          <Icon name="warning" />
          {missingCount} 個景點缺少座標，未顯示於地圖
        </div>
      )}
    </div>
  );
}
