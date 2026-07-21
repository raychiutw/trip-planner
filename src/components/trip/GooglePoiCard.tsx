/**
 * GooglePoiCard — 地圖點選 Google 原生 POI 後顯示的底部卡片。
 *
 * owner 2026-07-21「地圖模式的地圖點選 Google POI 開啟在 POI tab，然後可以另開
 * Google Map 視窗，如同 Flutter」。行為對齊 Flutter GooglePoiAccessoryCard
 * (google_poi_accessory_card.dart) — 只有圖示 + 店名 + 關閉(X) + 「在 Google
 * 地圖開啟」，不含加入行程 / 星等 / 地址等額外資訊（Flutter 端就只有這三樣）。
 *
 * web 特有落差（mockup docs/design-sessions/2026-07-21-google-poi-tap-card.html
 * 有記錄）：Google Maps JS API 的 IconMouseEvent 只給 placeId + 座標，沒有店名
 * （Flutter 原生 SDK 免費附帶）。這裡多打一次既有 GET /api/places/resolve 取得
 * 名稱 — resolve 前顯示「載入地點名稱…」，失敗（404 delisted / rate limit）則
 * fallback「Google 地圖地點」（對齊 Flutter selection.name 空字串時的同一句）。
 *
 * 「在 Google 地圖開啟」重用既有 buildMapsUrl()（src/lib/mapsUrl.ts），帶
 * query_place_id 精確定位，開新分頁（Flutter 端用 url_launcher 開外部
 * app/瀏覽器離開 app；web 對應行為是開新分頁，不導離目前分頁）。
 */
import { useEffect, useState } from 'react';
import Icon from '../shared/Icon';
import { apiFetch } from '../../lib/apiClient';
import { buildMapsUrl } from '../../lib/mapsUrl';
import type { GooglePoiClick } from '../../lib/mapHelpers';

interface PlaceResolveResponse {
  name?: string | null;
}

export interface GooglePoiCardProps {
  poi: GooglePoiClick;
  onClose: () => void;
}

const FALLBACK_NAME = 'Google 地圖地點';

export default function GooglePoiCard({ poi, onClose }: GooglePoiCardProps) {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setName(null);
    apiFetch<PlaceResolveResponse>(`/places/resolve?placeId=${encodeURIComponent(poi.placeId)}`)
      .then((res) => {
        if (cancelled) return;
        setName(res.name?.trim() || FALLBACK_NAME);
      })
      .catch(() => {
        if (cancelled) return;
        setName(FALLBACK_NAME);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [poi.placeId]);

  const openInGoogleMaps = () => {
    const url = buildMapsUrl(
      { name: name ?? '', lat: poi.lat, lng: poi.lng, placeId: poi.placeId },
      'google',
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="tp-google-poi-card" data-testid="google-poi-card">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-google-poi-row">
        <span className="tp-google-poi-icon" aria-hidden="true"><Icon name="location-pin" /></span>
        {loading ? (
          <span className="tp-google-poi-loading">載入地點名稱…</span>
        ) : (
          <span className="tp-google-poi-name">{name}</span>
        )}
        <button
          type="button"
          className="tp-google-poi-close"
          onClick={onClose}
          aria-label="關閉 Google 地圖地點"
        >
          <Icon name="x-mark" />
        </button>
      </div>
      <div className="tp-google-poi-actions">
        <button
          type="button"
          className="tp-google-poi-open"
          onClick={openInGoogleMaps}
          aria-label={`在 Google 地圖開啟${name ?? ''}`}
        >
          在 Google 地圖開啟 ↗
        </button>
      </div>
    </div>
  );
}

const SCOPED_STYLES = `
.tp-google-poi-card {
  background: color-mix(in srgb, var(--color-background) 88%, transparent);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid color-mix(in srgb, var(--color-foreground) 10%, transparent);
  border-radius: var(--radius-lg, 14px);
  box-shadow: 0 8px 24px rgba(42, 31, 24, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  padding: 12px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tp-google-poi-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.tp-google-poi-icon {
  width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px;
  color: var(--color-accent);
}
.tp-google-poi-icon .svg-icon { width: 20px; height: 20px; }
.tp-google-poi-name {
  flex: 1; min-width: 0;
  font-size: var(--font-size-headline, 15px);
  font-weight: 700;
  color: var(--color-foreground);
  line-height: 1.3;
}
.tp-google-poi-loading {
  flex: 1; min-width: 0;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
}
.tp-google-poi-close {
  width: var(--spacing-tap-min, 44px);
  height: var(--spacing-tap-min, 44px);
  margin: -10px -8px -10px 0;
  border: 0; border-radius: 50%;
  background: transparent;
  color: var(--color-muted);
  display: grid; place-items: center;
  cursor: pointer; flex-shrink: 0;
}
.tp-google-poi-close:hover { background: var(--color-hover); color: var(--color-foreground); }
.tp-google-poi-close .svg-icon { width: 16px; height: 16px; }
.tp-google-poi-actions { display: flex; justify-content: flex-end; }
.tp-google-poi-open {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: var(--spacing-tap-min, 44px);
  padding: 0 14px;
  border: 0; border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-accent);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 700;
  cursor: pointer;
}
.tp-google-poi-open:hover { background: var(--color-hover); }
`;
