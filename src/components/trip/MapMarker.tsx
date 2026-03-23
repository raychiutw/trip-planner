/**
 * MapMarker — 自訂圓形 Google Maps 覆蓋層 + InfoWindow 輕量卡片
 *
 * F003：
 * - 使用 Google Maps OverlayView 將 React 元素渲染在地圖上
 * - 圓形 32px，accent 色 + 白色編號；飯店用 🏨 emoji
 * - 選中狀態：放大至 40px + shadow-lg + 2px 白邊框
 * - InfoWindow：200px 卡片，編號 + 名稱 + 時間 + 評分 + 「滾到此處」按鈕
 * - Accessibility：role="button" + aria-label，Tab/Enter/Escape 鍵盤支援
 */

import { useEffect, useRef, useCallback } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MapPin } from '../../hooks/useMapData';

/* ===== Props ===== */

export interface MapMarkerProps {
  map: google.maps.Map;
  pin: MapPin;
  /** 1-based display index (entry) or 0 (hotel) */
  isSelected: boolean;
  onSelect: (pinId: number) => void;
  onScrollToEntry: (pinId: number) => void;
}

/* ===== InfoWindow Card (純 React 元件，渲染在 overlay DOM 內) ===== */

interface InfoWindowCardProps {
  pin: MapPin;
  onScrollToEntry: () => void;
  onClose: () => void;
}

function InfoWindowCard({ pin, onScrollToEntry, onClose }: InfoWindowCardProps) {
  const isHotel = pin.type === 'hotel';
  const label = isHotel ? '🏨 飯店' : `第 ${pin.index} 站`;

  return (
    <div
      className="map-info-window"
      role="dialog"
      aria-label={`${label}：${pin.title ?? ''}`}
    >
      {/* 關閉按鈕 */}
      <button
        className="map-info-close"
        type="button"
        aria-label="關閉"
        onClick={onClose}
      >
        ✕
      </button>

      {/* 編號 + 名稱 */}
      <div className="map-info-label">{label}</div>
      <div className="map-info-title">{pin.title}</div>

      {/* 時間（entry only）*/}
      {!isHotel && pin.time && (
        <div className="map-info-time">{pin.time}</div>
      )}

      {/* 評分（entry only）*/}
      {!isHotel && typeof pin.googleRating === 'number' && (
        <div className="map-info-rating">★ {pin.googleRating.toFixed(1)}</div>
      )}

      {/* 滾到此處按鈕（entry only）*/}
      {!isHotel && (
        <button
          className="map-info-scroll-btn"
          type="button"
          aria-label={`在時間軸中查看 ${pin.title ?? ''}`}
          onClick={onScrollToEntry}
        >
          滾到此處
        </button>
      )}
    </div>
  );
}

/* ===== Marker Dot 元件（渲染在 OverlayView 內）===== */

interface MarkerDotProps {
  pin: MapPin;
  isSelected: boolean;
  onClick: () => void;
  onScrollToEntry: () => void;
  onCloseInfo: () => void;
  showInfo: boolean;
}

function MarkerDot({ pin, isSelected, onClick, onScrollToEntry, onCloseInfo, showInfo }: MarkerDotProps) {
  const isHotel = pin.type === 'hotel';
  const ariaLabel = isHotel
    ? `飯店：${pin.title ?? ''}`
    : `第 ${pin.index} 站：${pin.title ?? ''}`;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
    if (e.key === 'Escape' && showInfo) {
      e.preventDefault();
      onCloseInfo();
    }
  }, [onClick, onCloseInfo, showInfo]);

  return (
    <div className="map-marker-wrap">
      {/* Marker circle */}
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-expanded={showInfo}
        aria-haspopup="dialog"
        className={`map-marker-dot${isSelected ? ' map-marker-dot--selected' : ''}`}
        onClick={onClick}
        onKeyDown={handleKeyDown}
      >
        {isHotel ? '🏨' : <span className="map-marker-num">{pin.index}</span>}
      </div>

      {/* InfoWindow */}
      {showInfo && (
        <InfoWindowCard
          pin={pin}
          onScrollToEntry={onScrollToEntry}
          onClose={onCloseInfo}
        />
      )}
    </div>
  );
}

/* ===== MapMarker 元件 (OverlayView 管理) ===== */

/**
 * MapMarker 使用 Google Maps OverlayView，讓 React DOM 渲染在地圖層上。
 * 這是一個「無 DOM」元件（只管理 OverlayView 的副作用）。
 */
export function MapMarker({ map, pin, isSelected, onSelect, onScrollToEntry }: MapMarkerProps) {
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reactRootRef = useRef<Root | null>(null);
  const showInfoRef = useRef(false);

  /* --- 重新渲染 marker dot --- */
  const renderDot = useCallback((selected: boolean, showInfo: boolean) => {
    if (!reactRootRef.current) return;
    showInfoRef.current = showInfo;

    reactRootRef.current.render(
      <MarkerDot
        pin={pin}
        isSelected={selected}
        showInfo={showInfo}
        onClick={() => {
          // 點擊 marker → 選中 + 開啟 InfoWindow
          onSelect(pin.id);
          renderDot(true, !showInfoRef.current);
        }}
        onScrollToEntry={() => {
          onScrollToEntry(pin.id);
        }}
        onCloseInfo={() => {
          renderDot(selected, false);
        }}
      />,
    );
  }, [pin, onSelect, onScrollToEntry]);

  /* --- 同步 isSelected 狀態 --- */
  useEffect(() => {
    if (reactRootRef.current) {
      renderDot(isSelected, isSelected ? showInfoRef.current : false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected]);

  /* --- 建立 OverlayView --- */
  useEffect(() => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.transform = 'translate(-50%, -100%)';
    container.style.cursor = 'pointer';
    container.style.zIndex = '1';
    containerRef.current = container;

    const root = createRoot(container);
    reactRootRef.current = root;

    /* 初始渲染 */
    root.render(
      <MarkerDot
        pin={pin}
        isSelected={isSelected}
        showInfo={false}
        onClick={() => {
          onSelect(pin.id);
          renderDot(true, !showInfoRef.current);
        }}
        onScrollToEntry={() => {
          onScrollToEntry(pin.id);
        }}
        onCloseInfo={() => {
          renderDot(isSelected, false);
        }}
      />,
    );

    /* OverlayView 類別 */
    class CustomOverlay extends google.maps.OverlayView {
      override onAdd() {
        const pane = this.getPanes()?.overlayMouseTarget;
        if (pane) pane.appendChild(container);
      }

      override draw() {
        const proj = this.getProjection();
        if (!proj) return;
        const pos = proj.fromLatLngToDivPixel(
          new google.maps.LatLng(pin.lat, pin.lng),
        );
        if (!pos) return;
        container.style.left = `${pos.x}px`;
        container.style.top = `${pos.y}px`;
      }

      override onRemove() {
        container.parentNode?.removeChild(container);
      }
    }

    const overlay = new CustomOverlay();
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      // React 18 concurrent-safe unmount
      setTimeout(() => root.unmount(), 0);
      overlay.setMap(null);
      overlayRef.current = null;
      containerRef.current = null;
      reactRootRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pin.lat, pin.lng, pin.id]);

  // 無 DOM 輸出，副作用全在 OverlayView
  return null;
}
