/**
 * TripMap — 多天總覽地圖元件（F006）
 *
 * 功能：
 * - 顯示所有天的 markers + polylines，每天使用固定 8 色色盤循環
 * - 左下角日期圖例：水平 pill 列，每個 pill「Day N」+ 顏色圓點
 * - 點擊圖例 pill 可高亮該天路線（其他天半透明），再點取消高亮
 * - fitBounds 自動調整 zoom 顯示所有天的 markers
 * - 收合/展開：預設展開，localStorage 記住偏好
 * - 所有狀態：loading skeleton、empty state、error fallback、success
 *
 * 色盤（固定 8 色，不隨主題變化）：
 *   Day 1: #4285F4  Day 2: #EA4335  Day 3: #34A853  Day 4: #FBBC04
 *   Day 5: #9C27B0  Day 6: #00ACC1  Day 7: #FF7043  Day 8+: #78909C（循環）
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { lsGet, lsSet } from '../../lib/localStorage';
import Icon from '../shared/Icon';
import type { Day } from '../../types/trip';
import { extractPinsFromDay } from '../../hooks/useMapData';
import type { MapPin } from '../../hooks/useMapData';
import { LS_KEY_MAP_COLLAPSED } from './DayMap';

/* ===== Constants ===== */

const GOOGLE_MAPS_URL_BASE = 'https://www.google.com/maps/search/';

/** 固定 8 色色盤（D6：不隨主題變化）*/
export const DAY_COLORS: readonly string[] = [
  '#4285F4', // Day 1: 藍
  '#EA4335', // Day 2: 紅
  '#34A853', // Day 3: 綠
  '#FBBC04', // Day 4: 金
  '#9C27B0', // Day 5: 紫
  '#00ACC1', // Day 6: 青
  '#FF7043', // Day 7: 橘
  '#78909C', // Day 8+: 灰（循環）
];

/** 取得 Day N 的色盤顏色（1-based dayIndex，超過 8 天循環）*/
export function getDayColor(dayIndex: number): string {
  const idx = ((dayIndex - 1) % DAY_COLORS.length + DAY_COLORS.length) % DAY_COLORS.length;
  return DAY_COLORS[idx];
}

/* ===== Types ===== */

export interface DayPinsData {
  dayNum: number;
  pins: MapPin[];
}

/* ===== Props ===== */

interface TripMapProps {
  /** 所有天的資料（用於提取 pins）*/
  allDays: Record<number, Day>;
  /** 天數概要列表（用於取得 day_num 排序）*/
  dayNums: number[];
}

/* ===== Helper: 從 Day 資料提取地圖 pins（委派給 useMapData 共用函式）===== */

export function extractDayPins(day: Day): MapPin[] {
  return extractPinsFromDay(day).pins;
}

/* ===== Helper: fallback URL ===== */

function buildFallbackUrl(): string {
  return `${GOOGLE_MAPS_URL_BASE}?api=1&query=trip+overview`;
}

/* ===== Component ===== */

export default function TripMap({ allDays, dayNums }: TripMapProps) {
  const { status, error } = useGoogleMaps();

  /* --- 計算所有天的 pins（含顏色）--- */
  const allDayPins = useMemo((): DayPinsData[] => {
    return dayNums
      .map((dayNum) => ({
        dayNum,
        pins: allDays[dayNum] ? extractDayPins(allDays[dayNum]) : [],
      }))
      .filter((d) => d.pins.length > 0);
  }, [allDays, dayNums]);

  const hasData = allDayPins.length > 0;

  /* --- 收合狀態：共用 DayMap 的 localStorage key --- */
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

  /* --- 高亮天數（null = 全部正常顯示）--- */
  const [highlightDay, setHighlightDay] = useState<number | null>(null);

  const handleLegendPillClick = useCallback((dayNum: number) => {
    setHighlightDay((prev) => (prev === dayNum ? null : dayNum));
  }, []);

  /* --- 地圖 DOM ref --- */
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polylinesRef = useRef<Map<number, google.maps.Polyline>>(new Map());
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  /* --- 地圖初始化 --- */
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !hasData) return;
    if (mapInstanceRef.current) return; // 已初始化

    const map = new google.maps.Map(mapRef.current, {
      zoom: 10,
      center: { lat: allDayPins[0].pins[0].lat, lng: allDayPins[0].pins[0].lng },
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

    /* --- 繪製所有天的 markers + polylines --- */
    const bounds = new google.maps.LatLngBounds();

    for (let i = 0; i < allDayPins.length; i++) {
      const { dayNum, pins } = allDayPins[i];
      const color = getDayColor(dayNums.indexOf(dayNum) + 1);

      // Markers
      for (const pin of pins) {
        bounds.extend({ lat: pin.lat, lng: pin.lng });

        // TODO: migrate to google.maps.marker.AdvancedMarkerElement (requires Map ID via mapId option)
        // See https://developers.google.com/maps/documentation/javascript/advanced-markers/migration
        const marker = new google.maps.Marker({
          position: { lat: pin.lat, lng: pin.lng },
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          title: pin.title,
        });

        markersRef.current.set(`${dayNum}-${pin.id}`, marker);
      }

      // Polyline（連接同一天的 markers，依 sort_order 排序）
      if (pins.length >= 2) {
        const path = [...pins]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((pin) => ({ lat: pin.lat, lng: pin.lng }));

        const polyline = new google.maps.Polyline({
          path,
          geodesic: false,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          map,
        });

        polylinesRef.current.set(dayNum, polyline);
      }
    }

    /* --- fitBounds 自動調整 zoom --- */
    map.fitBounds(bounds, 40);
  }, [status, hasData, allDayPins, dayNums]);

  /* --- 高亮效果：切換 polylines + markers 透明度 --- */
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    for (const [dayNum, polyline] of polylinesRef.current) {
      if (highlightDay === null || dayNum === highlightDay) {
        polyline.setOptions({ strokeOpacity: 0.8 });
      } else {
        polyline.setOptions({ strokeOpacity: 0.15 });
      }
    }

    for (const [key, marker] of markersRef.current) {
      const markerDayNum = parseInt(key.split('-')[0], 10);
      const icon = marker.getIcon() as google.maps.Symbol;
      if (icon) {
        if (highlightDay === null || markerDayNum === highlightDay) {
          marker.setIcon({ ...icon, fillOpacity: 0.9 });
        } else {
          marker.setIcon({ ...icon, fillOpacity: 0.2 });
        }
      }
    }
  }, [highlightDay]);

  /* --- 元件 unmount：清除地圖資源 --- */
  useEffect(() => {
    return () => {
      for (const polyline of polylinesRef.current.values()) {
        polyline.setMap(null);
      }
      for (const marker of markersRef.current.values()) {
        marker.setMap(null);
      }
      polylinesRef.current.clear();
      markersRef.current.clear();
      mapInstanceRef.current = null;
    };
  }, []);

  /* ===== Render ===== */

  return (
    <div className="day-map-section" data-testid="trip-map-section">
      {/* Header：標籤 + 收合按鈕 */}
      <div className="day-map-header">
        <span className="day-map-header-label">
          <Icon name="map" />
          全覽地圖
        </span>
        <button
          className="day-map-toggle-btn"
          aria-expanded={!collapsed}
          aria-controls="trip-map"
          onClick={handleToggle}
          type="button"
        >
          <Icon name={collapsed ? 'expand-more' : 'expand-less'} />
          {collapsed ? '展開地圖' : '收合地圖'}
        </button>
      </div>

      {/* 地圖主體：收合/展開動畫 */}
      <div
        id="trip-map"
        role="region"
        aria-label="全行程總覽地圖"
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
            data-testid="trip-map-skeleton"
          />
        ) : null}

        {/* Case 2：SDK 載入失敗 → error fallback */}
        {status === 'error' ? (
          <div
            className="day-map-error"
            role="alert"
            data-testid="trip-map-error"
          >
            <Icon name="warning" />
            <p className="day-map-error-title">地圖無法載入</p>
            <p className="day-map-error-desc">
              {error ?? 'Google Maps SDK 無法載入，請確認網路連線。'}
            </p>
            <a
              className="day-map-error-link"
              href={buildFallbackUrl()}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="在 Google Maps 中查看行程"
            >
              <Icon name="map" />
              前往 Google Maps
            </a>
          </div>
        ) : null}

        {/* Case 3：SDK ready + 無資料 → empty state */}
        {status === 'ready' && !hasData ? (
          <div
            className="day-map-empty"
            data-testid="trip-map-empty"
          >
            尚無地點資料
          </div>
        ) : null}

        {/* Case 4：SDK ready + 有資料 → 地圖容器 */}
        {status === 'ready' && hasData ? (
          <div className="day-map-container" data-testid="trip-map-container">
            <div
              ref={mapRef}
              className="day-map"
              aria-label="全行程互動地圖"
              data-testid="trip-map-canvas"
            />

            {/* 日期圖例（左下角，F006.3）*/}
            <div
              className="trip-map-legend"
              role="list"
              aria-label="天數圖例"
              data-testid="trip-map-legend"
            >
              {allDayPins.map(({ dayNum }) => {
                const colorIndex = dayNums.indexOf(dayNum) + 1;
                const color = getDayColor(colorIndex);
                const isHighlighted = highlightDay === dayNum;
                const isDimmed = highlightDay !== null && !isHighlighted;

                return (
                  <button
                    key={dayNum}
                    role="listitem"
                    className={clsx(
                      'trip-map-legend-pill',
                      isDimmed && 'trip-map-legend-pill--dimmed',
                      isHighlighted && 'trip-map-legend-pill--active',
                    )}
                    style={{ background: isHighlighted ? color + '22' : 'var(--color-secondary)' }}
                    onClick={() => handleLegendPillClick(dayNum)}
                    aria-pressed={isHighlighted}
                    aria-label={`高亮 Day ${dayNum} 路線`}
                    data-testid={`trip-map-legend-pill-${dayNum}`}
                    type="button"
                  >
                    <span
                      className="trip-map-legend-dot"
                      style={{ background: color }}
                      aria-hidden="true"
                    />
                    Day {dayNum}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
