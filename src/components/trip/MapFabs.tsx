/**
 * MapFabs — Section 4.10 (terracotta-mockup-parity-v2)
 *
 * 對應 mockup section 20。MapPage 右下角 FAB stack 兩顆 button：
 *   1. 圖層切換：popover 給 街道 / 衛星 / 地形 3 選項，click → swap Leaflet
 *      tile layer (instance.eachLayer 找 L.TileLayer remove + 新 add)
 *   2. 我的位置：navigator.geolocation 取座標 → map.flyTo + 顯示一顆 user marker
 *
 * 為了不直接耦合 Leaflet API，本 component 收 `map: L.Map | null` prop（由
 * MapPage 透過 OceanMap 既有 onMapReady 拉出來）。當 map 為 null（還沒 mount）
 * FAB 被 disable。
 */
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import Icon from '../shared/Icon';
import { showToast } from '../shared/Toast';

export type MapTileStyle = 'street' | 'satellite' | 'terrain';

interface TilePreset {
  key: MapTileStyle;
  label: string;
  url: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
}

const TILE_PRESETS: TilePreset[] = [
  {
    key: 'street',
    label: '街道',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abc',
    maxZoom: 19,
  },
  {
    key: 'satellite',
    // Esri World Imagery — 公開不需 token，給 demo 用；prod scaling 需自家 key。
    label: '衛星',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
  },
  {
    key: 'terrain',
    // OpenTopoMap — OSM-based topographic, 需 attribution。
    label: '地形',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    subdomains: 'abc',
    maxZoom: 17,
  },
];

const SCOPED_STYLES = `
.tp-map-fabs {
  /* 2026-04-29:explicit top/left auto + width max-content 防止 box stretch
   * 全屏。Issue:absolute 在某些 layout context 沒設 left/right 時 default
   * 取 normal flow position(可能變 0)+ 設 right:16 後 box 從 0 拉到 right:16
   * 形成全屏 stretch。computed style 量到 top:-16 left:-16 width:viewport,
   * FAB 跑到左上而非右下。force inset-inline-start: auto 解決。 */
  position: absolute;
  top: auto; left: auto;
  right: 16px; bottom: 16px;
  width: max-content; height: max-content;
  display: flex; flex-direction: column; gap: 10px;
  z-index: 400;
}
.tp-map-fab {
  width: 44px; height: 44px;
  border-radius: 50%;
  border: 0;
  background: var(--color-background);
  color: var(--color-foreground);
  display: grid; place-items: center;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: background 120ms, transform 120ms;
}
.tp-map-fab:hover { background: var(--color-hover); transform: translateY(-1px); }
.tp-map-fab:disabled { opacity: 0.4; cursor: not-allowed; }
.tp-map-fab.is-active { background: var(--color-accent); color: var(--color-accent-foreground); }
.tp-map-fab .svg-icon { width: 20px; height: 20px; }
.tp-map-fab-popover {
  position: absolute;
  right: 56px; bottom: 0;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 4px;
  display: flex; flex-direction: column; gap: 2px;
  min-width: 120px;
}
.tp-map-fab-option {
  border: 0; background: transparent;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-foreground);
  cursor: pointer; text-align: left;
}
.tp-map-fab-option:hover { background: var(--color-hover); }
.tp-map-fab-option.is-active { background: var(--color-accent-subtle); color: var(--color-accent-deep); }
`;

export interface MapFabsProps {
  map: L.Map | null;
  /** Default style on mount. */
  initialStyle?: MapTileStyle;
}

export default function MapFabs({ map, initialStyle = 'street' }: MapFabsProps) {
  const [style, setStyle] = useState<MapTileStyle>(initialStyle);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function applyStyle(next: MapTileStyle) {
    if (!map) return;
    if (next === style) {
      setOpen(false);
      return;
    }
    const preset = TILE_PRESETS.find((p) => p.key === next);
    if (!preset) return;
    // 移除既有 tile layer
    const existing: L.TileLayer[] = [];
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) existing.push(layer);
    });
    existing.forEach((t) => map.removeLayer(t));
    // 加新 tile layer
    L.tileLayer(preset.url, {
      attribution: preset.attribution,
      subdomains: preset.subdomains ?? 'abc',
      maxZoom: preset.maxZoom,
    }).addTo(map);
    setStyle(next);
    setOpen(false);
  }

  function locateMe() {
    if (!map || locating) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('此瀏覽器不支援定位', 'error', 3000);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], 14, { duration: 0.6 });
        // 換掉舊 marker 或新增
        if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = L.circleMarker([latitude, longitude], {
          radius: 8,
          color: 'var(--color-accent)',
          fillColor: 'var(--color-accent)',
          fillOpacity: 0.85,
          weight: 3,
        }).addTo(map);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        showToast(`無法取得位置：${err.message}`, 'error', 3000);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }

  return (
    <div className="tp-map-fabs" data-testid="map-fabs">
      <style>{SCOPED_STYLES}</style>
      <div ref={popoverRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className={`tp-map-fab ${open ? 'is-active' : ''}`}
          onClick={() => setOpen((o) => !o)}
          disabled={!map}
          aria-label="切換地圖圖層"
          aria-haspopup="menu"
          aria-expanded={open}
          data-testid="map-fab-layers"
        >
          <Icon name="layers" />
        </button>
        {open && (
          <div className="tp-map-fab-popover" role="menu" data-testid="map-fab-layers-popover">
            {TILE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="menuitemradio"
                aria-checked={style === p.key}
                className={`tp-map-fab-option ${style === p.key ? 'is-active' : ''}`}
                onClick={() => applyStyle(p.key)}
                data-testid={`map-fab-layers-option-${p.key}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        className={`tp-map-fab ${locating ? 'is-active' : ''}`}
        onClick={locateMe}
        disabled={!map || locating}
        aria-label="定位到我的位置"
        data-testid="map-fab-locate"
      >
        <Icon name="location-pin" />
      </button>
    </div>
  );
}
