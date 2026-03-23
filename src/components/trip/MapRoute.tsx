/**
 * MapRoute — 直線 Polyline 連接 markers + 車程資訊 label
 *
 * F004：
 * - 使用 Google Maps Polyline API 直線連接所有 MapPin，依 sort_order 排序
 * - 飯店也參與連線（sortOrder = -1，顯示在最前）
 * - 線條樣式：accent 色，2px 寬，opacity 0.7
 * - pins 增減時動態更新路徑（setPath，不重建 Polyline）
 * - 元件 unmount 時清除 Polyline（setMap(null)）
 *
 * F005：
 * - 在相鄰兩點 Polyline 中點位置顯示車程耗時 label（例如「🚗 15min」）
 * - 使用 Google Maps OverlayView 自訂 label 元件
 * - 只有 travelMin > 0 的 segment 才顯示 label
 * - 無 travelMin → 不顯示 label
 *
 * 顏色策略：
 * - Google Maps Polyline 需要 hex/rgb 顏色字串，無法直接傳 CSS 變數
 * - 透過 getComputedStyle 讀取 document.documentElement 的 --color-accent 解析色值
 * - fallback：若讀取失敗或空值則使用 #007AFF（系統藍）
 */

import { useEffect, useRef } from 'react';
import type { MapPin } from '../../hooks/useMapData';

/* ===== Props ===== */

export interface MapRouteProps {
  map: google.maps.Map;
  pins: MapPin[];
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
      this.div.className = 'map-route-label';
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
 * Effect 依賴 [map, pins]。
 * 使用 prevMapRef 追蹤 map 實例是否改變：
 * - map 改變（含初始）→ 建立新 Polyline，並直接 setPath（不在 cleanup 清 ref）
 * - 只有 pins 改變 → setPath 更新路徑
 * - pins < 2 → 清除 Polyline
 *
 * F005：每次 pins 更新時同步更新 TravelLabelOverlay：
 * - 清除舊 overlays → 重新建立新 overlays
 *
 * **重要**：cleanup 只在 unmount 時才清除 Polyline（透過 isMounted flag）。
 * pins 變化觸發 cleanup 時，不清除 Polyline，讓下次 effect 直接 setPath。
 */
export function MapRoute({ map, pins }: MapRouteProps) {
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

    if (pins.length < 2) {
      // 不足 2 個 pin → 清除現有 Polyline 和 labels
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      clearLabels();
      return;
    }

    const path = buildPath(pins);

    if (mapChanged || !polylineRef.current) {
      // map 換掉或 Polyline 不存在 → 清除舊的（如有），建新的
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
      polylineRef.current = new google.maps.Polyline({
        path,
        geodesic: false,
        strokeColor: getAccentColor(),
        strokeOpacity: 0.7,
        strokeWeight: 2,
        map,
      });
    } else {
      // map 未變，Polyline 存在 → 只更新路徑
      polylineRef.current.setPath(path);
    }

    /* --- F005：更新 travel label overlays --- */
    clearLabels();
    const segments = buildTravelSegments(pins);
    for (const seg of segments) {
      const overlay = createTravelLabelOverlay(
        { lat: seg.midLat, lng: seg.midLng },
        seg.label,
      );
      overlay.setMap(map);
      labelsRef.current.push(overlay);
    }
  }, [map, pins]);

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
