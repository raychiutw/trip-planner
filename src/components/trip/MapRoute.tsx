/**
 * MapRoute — Directions API 路線 Polyline + 車程資訊 label
 *
 * F004 → F006：
 * - 使用 Directions API 取得實際道路路線（取代直線 Polyline）
 * - routePath（從 useDirectionsRoute hook）作為 Polyline path
 * - 載入中或無路線 → 不渲染任何連線（只顯示 markers）
 * - 線條樣式：accent 色，2px 寬，opacity 0.7
 * - routePath 更新時動態 setPath（不重建 Polyline）
 * - 元件 unmount 時清除 Polyline（setMap(null)）
 *
 * F005：
 * - 車程 label 位置改用 Directions API 的 leg 路徑中點（legMidpoints）
 * - label 文字仍來自 pins 的 travelMin / travelType
 * - 只有 travelMin > 0 的 segment 才顯示 label
 *
 * 顏色策略：
 * - Google Maps Polyline 需要 hex/rgb 顏色字串，無法直接傳 CSS 變數
 * - 透過 getComputedStyle 讀取 document.documentElement 的 --color-accent 解析色值
 * - fallback：若讀取失敗或空值則使用 #007AFF（系統藍）
 */

import { useEffect, useRef } from 'react';
import type { MapPin } from '../../hooks/useMapData';
import { sortPinsByOrder } from '../../hooks/useDirectionsRoute';

/* ===== Props ===== */

export interface MapRouteProps {
  map: google.maps.Map;
  pins: MapPin[];
  /** Directions API 回傳的完整路線 path，null = 載入中或失敗 */
  routePath?: google.maps.LatLngLiteral[] | null;
  /** 每段 leg 的路徑中點（用於 travel label 定位） */
  legMidpoints?: google.maps.LatLngLiteral[];
  /** 是否正在載入路線 */
  routeLoading?: boolean;
}

/* ===== 讀取 CSS 變數 color（hex/rgb 字串）===== */

export function getAccentColor(): string {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent')
      .trim();
    return value || '#007AFF';
  } catch {
    return '#007AFF';
  }
}

/* ===== 將 pins 依 sort_order 排序並轉換為 LatLng path ===== */

export function buildPath(pins: MapPin[]): google.maps.LatLngLiteral[] {
  return [...pins]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((pin) => ({ lat: pin.lat, lng: pin.lng }));
}

/* ===== 車程 label 相關 ===== */

/** 每段路徑的車程資訊（F005） */
export interface TravelSegment {
  /** 中點座標 */
  midLat: number;
  midLng: number;
  /** label 文字，例如「🚗 15min」或「🚶 5min」*/
  label: string;
}

/** 依 travel type 選擇 emoji */
export function getTravelEmoji(travelType?: string | null): string {
  if (!travelType) return '🚗';
  const t = travelType.toLowerCase();
  if (t === 'walk' || t === 'walking' || t === 'foot') return '🚶';
  if (t === 'train' || t === 'rail' || t === 'subway' || t === 'transit') return '🚆';
  if (t === 'bus') return '🚌';
  if (t === 'ferry' || t === 'boat' || t === 'ship') return '⛴️';
  return '🚗'; // 預設汽車
}

/**
 * 從已排序的 pins 計算每段 Polyline 的中點 + label 文字。
 * 只有第二個 pin 的 travelMin > 0 時才產生 segment。
 */
export function buildTravelSegments(pins: MapPin[]): TravelSegment[] {
  const sorted = [...pins].sort((a, b) => a.sortOrder - b.sortOrder);
  const segments: TravelSegment[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    // 只有 travelMin > 0 才顯示 label
    if (!curr.travelMin || curr.travelMin <= 0) continue;

    const midLat = (prev.lat + curr.lat) / 2;
    const midLng = (prev.lng + curr.lng) / 2;
    const emoji = getTravelEmoji(curr.travelType);
    const label = `${emoji} ${curr.travelMin}min`;

    segments.push({ midLat, midLng, label });
  }

  return segments;
}

/* ===== TravelLabelOverlay — Google Maps OverlayView（lazy class factory）===== */

/**
 * 建立 TravelLabelOverlay 實例的工廠函式。
 *
 * 之所以用「工廠函式」而非「直接 class extends」：
 * - `class Foo extends google.maps.OverlayView` 是 class declaration，
 *   在模組載入時就執行（class body 被解析），此時 google.maps 可能尚未初始化。
 * - 工廠函式只在呼叫時才執行 extends，確保 google.maps.OverlayView 已存在。
 * - 測試環境中只需要在呼叫 createTravelLabelOverlay 前設置好 google.maps.OverlayView。
 */
export function createTravelLabelOverlay(
  position: google.maps.LatLngLiteral,
  label: string,
): google.maps.OverlayView & { getLabel(): string; getPosition(): google.maps.LatLngLiteral } {
  class TravelLabelOverlay extends google.maps.OverlayView {
    private readonly pos: google.maps.LatLngLiteral;
    private readonly labelText: string;
    private div: HTMLDivElement | null = null;

    constructor(p: google.maps.LatLngLiteral, l: string) {
      super();
      this.pos = p;
      this.labelText = l;
    }

    override onAdd() {
      this.div = document.createElement('div');
      this.div.className = 'absolute -translate-x-1/2 -translate-y-1/2 bg-secondary text-muted text-caption py-1 px-2 rounded-xs shadow-sm whitespace-nowrap pointer-events-none select-none';
      this.div.textContent = this.labelText;
      this.div.setAttribute('aria-hidden', 'true');

      const panes = this.getPanes();
      if (panes) {
        panes.overlayLayer.appendChild(this.div);
      }
    }

    override draw() {
      if (!this.div) return;
      const overlayProjection = this.getProjection();
      if (!overlayProjection) return;

      const point = overlayProjection.fromLatLngToDivPixel(
        new google.maps.LatLng(this.pos.lat, this.pos.lng),
      );
      if (!point) return;

      // 置中顯示：以 translate(-50%, -50%) 讓元素中心對齊座標點
      this.div.style.left = `${point.x}px`;
      this.div.style.top = `${point.y}px`;
    }

    override onRemove() {
      if (this.div?.parentNode) {
        this.div.parentNode.removeChild(this.div);
      }
      this.div = null;
    }

    /** 取得 label 文字（供測試使用）*/
    getLabel(): string {
      return this.labelText;
    }

    /** 取得中點座標（供測試使用）*/
    getPosition(): google.maps.LatLngLiteral {
      return this.pos;
    }
  }

  return new TravelLabelOverlay(position, label);
}

/* ===== Component ===== */

/**
 * MapRoute 是純副作用元件（無 DOM 輸出）。
 *
 * Effect 依賴 [map, pins, routePath, legMidpoints, routeLoading]。
 * - routeLoading 或無 routePath → 清除 Polyline + labels
 * - routePath 提供 → 建立/更新 Polyline
 * - labels 位置來自 legMidpoints，文字來自 pins
 */
export function MapRoute({ map, pins, routePath, legMidpoints, routeLoading }: MapRouteProps) {
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const prevMapRef = useRef<google.maps.Map | null>(null);
  const labelsRef = useRef<ReturnType<typeof createTravelLabelOverlay>[]>([]);

  /* --- 清除所有 travel label overlays --- */
  function clearLabels() {
    for (const overlay of labelsRef.current) {
      overlay.setMap(null);
    }
    labelsRef.current = [];
  }

  useEffect(() => {
    const mapChanged = prevMapRef.current !== map;
    prevMapRef.current = map;

    /* 載入中或無路線 → 清除 Polyline + labels，不渲染任何連線 */
    if (routeLoading || !routePath || routePath.length < 2) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      clearLabels();
      return;
    }

    /* 建立/更新 Polyline（使用 Directions API 的實際道路路線） */
    if (mapChanged || !polylineRef.current) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
      polylineRef.current = new google.maps.Polyline({
        path: routePath,
        geodesic: false,
        strokeColor: getAccentColor(),
        strokeOpacity: 0.7,
        strokeWeight: 2,
        map,
      });
    } else {
      polylineRef.current.setPath(routePath);
    }

    /* Travel labels：text from pins, position from legMidpoints */
    clearLabels();
    const sorted = sortPinsByOrder(pins);
    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i];
      if (!curr.travelMin || curr.travelMin <= 0) continue;

      const emoji = getTravelEmoji(curr.travelType);
      const label = `${emoji} ${curr.travelMin}min`;
      const pos = legMidpoints?.[i - 1];
      if (!pos) continue;

      const overlay = createTravelLabelOverlay(pos, label);
      overlay.setMap(map);
      labelsRef.current.push(overlay);
    }
  }, [map, pins, routePath, legMidpoints, routeLoading]);

  /* --- Unmount cleanup：清除 Polyline + labels --- */
  useEffect(() => {
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      clearLabels();
    };
  }, []);

  // 無 DOM 輸出，副作用全在 Polyline + OverlayView
  return null;
}
