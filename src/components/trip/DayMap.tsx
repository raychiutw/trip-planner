/**
 * DayMap — 單天互動地圖元件
 *
 * F002：基礎 Google Maps 渲染 + 收合/展開 + 所有狀態處理
 * - Loading skeleton（SDK 載入中）
 * - Empty state（無座標景點）
 * - Error fallback（SDK 載入失敗）
 * - Partial warning（部分景點缺少座標）
 * - Success（地圖渲染）
 *
 * 使用 React.lazy + Suspense code-split（由 TripPage 管理）。
 * 收合狀態存 localStorage，key: map-collapsed。
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { useMapData } from '../../hooks/useMapData';
import { lsGet, lsSet } from '../../lib/localStorage';
import Icon from '../shared/Icon';
import type { Day } from '../../types/trip';

/* ===== Constants ===== */

const LS_KEY_COLLAPSED = 'map-collapsed';
const GOOGLE_MAPS_URL_BASE = 'https://www.google.com/maps/search/';

/* ===== Props ===== */

interface DayMapProps {
  day: Day | null | undefined;
  dayNum: number;
}

/* ===== Helper: build fallback Google Maps search URL ===== */

function buildFallbackUrl(dayNum: number): string {
  return `${GOOGLE_MAPS_URL_BASE}?api=1&query=day+${dayNum}+sightseeing`;
}

/* ===== Component ===== */

export default function DayMap({ day, dayNum }: DayMapProps) {
  const { status, error } = useGoogleMaps();
  const { pins, missingCount, hasData } = useMapData(day);

  /* --- 收合狀態：預設展開，localStorage 持久化 --- */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const saved = lsGet<boolean>(LS_KEY_COLLAPSED);
    return saved === true;
  });

  const handleToggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      lsSet(LS_KEY_COLLAPSED, next);
      return next;
    });
  }, []);

  /* --- 地圖 DOM ref --- */
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

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
      // 暗色模式：使用 Google Maps styles（預留，F002 先不套暗色主題）
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
  }, [status, hasData, pins]);

  /* --- 地圖 instance cleanup --- */
  useEffect(() => {
    return () => {
      mapInstanceRef.current = null;
    };
  }, []);

  /* ===== Render ===== */

  const mapId = `day-map-${dayNum}`;

  return (
    <div className="day-map-section" data-testid="day-map-section">
      {/* Header：標籤 + 收合按鈕 */}
      <div className="day-map-header">
        <span className="day-map-header-label">
          <Icon name="map" />
          動線地圖
        </span>
        <button
          className="day-map-toggle-btn"
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
          'day-map-wrap',
          collapsed ? 'day-map-wrap--collapsed' : 'day-map-wrap--expanded',
        )}
        aria-hidden={collapsed}
      >
        {/* Case 1：SDK 載入中 → skeleton */}
        {status === 'loading' || status === 'idle' ? (
          <div
            className="day-map-skeleton"
            role="status"
            aria-label="地圖載入中"
            data-testid="day-map-skeleton"
          />
        ) : null}

        {/* Case 2：SDK 載入失敗 → error fallback */}
        {status === 'error' ? (
          <div
            className="day-map-error"
            role="alert"
            data-testid="day-map-error"
          >
            <Icon name="warning" />
            <p className="day-map-error-title">地圖無法載入</p>
            <p className="day-map-error-desc">
              {error ?? 'Google Maps SDK 無法載入，請確認網路連線。'}
            </p>
            <a
              className="day-map-error-link"
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
            className="day-map-empty"
            data-testid="day-map-empty"
          >
            今天沒有排程景點座標
          </div>
        ) : null}

        {/* Case 4：SDK ready + 有資料 → 地圖容器 */}
        {status === 'ready' && hasData ? (
          <div className="day-map-container" data-testid="day-map-container">
            <div
              ref={mapRef}
              className="day-map"
              aria-label={`第 ${dayNum} 天互動地圖`}
              data-testid="day-map-canvas"
            />
          </div>
        ) : null}
      </div>

      {/* 部分座標缺失提示條（展開時顯示） */}
      {!collapsed && status === 'ready' && missingCount > 0 && (
        <div
          className="day-map-warning"
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
