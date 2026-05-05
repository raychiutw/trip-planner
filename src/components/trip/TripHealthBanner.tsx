/**
 * TripHealthBanner — POI lifecycle health banner shown atop TripPage.
 *
 * 對齊 GlobalStatusBanner pattern (DESIGN.md L545)。從 GET /api/trips/:id/health 拿
 * closed + missing count + items；若全 0 → return null（不渲染 stub）。
 *
 * Sticky chrome group integration（DESIGN.md L287/339-343）：
 *   TitleBar (top:0) → banner (top: 56/64) → DayNav (top: TitleBar+banner)
 *   Caller (TripPage) 套 className 控制 sticky；本 component 自身不設 position。
 *
 * a11y: role="status" + aria-live="polite" + 不可 dismiss（issue 是 actionable）。
 *
 * Mobile compact: 單行 truncate「N 個地點異常 ›」
 * Desktop full: 「此行程有 N 個地點已歇業 + M 個查無資料，點擊查看 ›」
 *
 * Click → onIssueClick(first_poi_id)，parent 開 StopLightbox。
 *
 * Loading 期間 hidden（避免 banner flash）。Fetch error → 預設 hidden（不打擾）。
 *
 * Refresh trigger: caller 改變 `refreshKey` prop → 重 fetch（POI mutation 後 invalidate）。
 */
import { useEffect, useState } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface HealthItem {
  poi_id: number;
  poi_name: string;
  status: 'closed' | 'missing';
  reason: string | null;
}

interface HealthResponse {
  version: number;
  closed: number;
  missing: number;
  items: HealthItem[];
}

export interface TripHealthBannerProps {
  tripId: string;
  /** 改變此值會觸發重 fetch（POI status 改變後 caller bump 即可）。 */
  refreshKey?: number;
  /** Click 處理：傳第一 issue 的 poi_id。Caller 開 StopLightbox 給該 POI。 */
  onIssueClick?: (poiId: number) => void;
  /** Mobile compact mode 強制（test override）。預設依 viewport 自動。 */
  compact?: boolean;
}

const TripHealthBannerStyles = `
.tp-trip-health-banner {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px;
  background: var(--color-warning-bg, rgba(244, 140, 6, 0.12));
  border-bottom: 1px solid rgba(244, 140, 6, 0.35);
  color: var(--color-foreground);
  font-size: 14px;
  cursor: pointer;
  border: 0; width: 100%; text-align: left;
  font-family: inherit;
}
.tp-trip-health-banner:hover { background: rgba(244, 140, 6, 0.20); }
.tp-trip-health-banner:focus-visible {
  outline: 2px solid var(--color-warning, #C88500);
  outline-offset: -2px;
}
.tp-trip-health-banner-icon {
  width: 24px; height: 24px;
  display: grid; place-items: center;
  border-radius: 50%;
  background: var(--color-warning, #C88500);
  color: #fff; font-size: 14px; font-weight: 700;
  flex-shrink: 0;
}
.tp-trip-health-banner-text { flex: 1; min-width: 0; }
.tp-trip-health-banner-text-compact {
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
  overflow: hidden;
}
.tp-trip-health-banner-chevron {
  font-size: 18px;
  color: var(--color-warning, #C88500);
  flex-shrink: 0;
}
@media (min-width: 1024px) {
  .tp-trip-health-banner { padding: 12px 24px; font-size: 15px; }
}
`;

async function fetchHealth(tripId: string, signal: AbortSignal): Promise<HealthResponse | null> {
  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/health`, { signal });
  if (!res.ok) return null;
  return (await res.json()) as HealthResponse;
}

export default function TripHealthBanner({
  tripId,
  refreshKey = 0,
  onIssueClick,
  compact: compactProp,
}: TripHealthBannerProps) {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const autoCompact = useMediaQuery('(max-width: 1023px)');

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    fetchHealth(tripId, ctl.signal)
      .then((res) => {
        if (!ctl.signal.aborted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!ctl.signal.aborted) {
          setData(null);
          setLoading(false);
        }
      });
    return () => ctl.abort();
  }, [tripId, refreshKey]);

  if (loading) return null;
  if (!data) return null;
  if (data.closed === 0 && data.missing === 0) return null;

  const compact = compactProp ?? autoCompact;
  const totalIssues = data.closed + data.missing;
  const firstIssuePoiId = data.items[0]?.poi_id ?? null;

  const handleClick = () => {
    if (firstIssuePoiId !== null && onIssueClick) {
      onIssueClick(firstIssuePoiId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  let labelText: string;
  if (compact) {
    labelText = `${totalIssues} 個地點異常`;
  } else {
    const parts: string[] = [];
    if (data.closed > 0) parts.push(`${data.closed} 個地點已歇業`);
    if (data.missing > 0) parts.push(`${data.missing} 個查無資料`);
    labelText = `此行程有 ${parts.join(' + ')}，點擊查看`;
  }

  return (
    <>
      <style>{TripHealthBannerStyles}</style>
      <button
        type="button"
        className="tp-trip-health-banner"
        role="status"
        aria-live="polite"
        data-testid="trip-health-banner"
        data-closed={data.closed}
        data-missing={data.missing}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <span className="tp-trip-health-banner-icon" aria-hidden="true">!</span>
        <span className="tp-trip-health-banner-text">
          {compact ? (
            <span className="tp-trip-health-banner-text-compact">{labelText}</span>
          ) : (
            labelText
          )}
        </span>
        <span className="tp-trip-health-banner-chevron" aria-hidden="true">›</span>
      </button>
    </>
  );
}
