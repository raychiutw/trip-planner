/**
 * TripSheet — URL-driven right sheet for /trip/:id route.
 *
 * Reads `?sheet=itinerary|ideas|map|chat` and renders the matching tab content.
 * Default tab is `map` (matches B-P2 transitional behavior where sheet slot
 * held TripMapRail directly).
 */
import { lazy, Suspense, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  parseSheetParam,
  setSheetParam,
  closeSheet,
  type SheetTab,
} from '../../lib/trip-url';
import TripSheetTabs from './TripSheetTabs';
import type { MapPin } from '../../hooks/useMapData';

const TripMapRail = lazy(() => import('./TripMapRail'));

const DEFAULT_TAB: SheetTab = 'map';

const SCOPED_STYLES = `
.trip-sheet {
  display: flex; flex-direction: column;
  height: 100%;
  background: var(--color-background);
  border-left: 1px solid var(--color-border);
}
.trip-sheet-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.trip-sheet-close {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-muted);
  display: grid; place-items: center; cursor: pointer;
  font: inherit; font-size: 14px;
}
.trip-sheet-close:hover { border-color: var(--color-accent); color: var(--color-accent); }
.trip-sheet-body { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.trip-sheet-placeholder {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 48px 24px; text-align: center; color: var(--color-muted);
  gap: 8px;
}
.trip-sheet-placeholder .eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
}
.trip-sheet-placeholder h3 {
  font-size: var(--font-size-title3); font-weight: 700; letter-spacing: -0.01em;
  color: var(--color-foreground);
}
.trip-sheet-placeholder p { font-size: var(--font-size-callout); max-width: 320px; }

/* TripMapRail 預設 .trip-map-rail 是給 main column scroll context 用：
   position:sticky + height:calc(100dvh - var(--spacing-nav-h))。
   放進 sheet 後 sticky 失效，且 100dvh 不等於 sheet 可用高度 → map 視覺只佔約 1/4。
   用 specificity (0,2,0) 覆蓋成 static + 撐滿 sheet body。 */
.trip-sheet-body .trip-map-rail {
  position: static;
  top: auto;
  height: 100%;
}
`;

export interface TripSheetProps {
  /** Trip ID for TripMapRail key + data. */
  tripId: string;
  /** All pins across days (for map overview). */
  allPins: MapPin[];
  /** Per-day pins map. */
  pinsByDay: Map<number, MapPin[]>;
  dark?: boolean;
}

export default function TripSheet({ tripId, allPins, pinsByDay, dark }: TripSheetProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab: SheetTab = useMemo(() => {
    return parseSheetParam(location.search) ?? DEFAULT_TAB;
  }, [location.search]);

  const handleTabChange = useCallback(
    (tab: SheetTab) => {
      setSheetParam(navigate, location.pathname, location.search, tab);
    },
    [navigate, location.pathname, location.search],
  );

  const handleClose = useCallback(() => {
    closeSheet(navigate, location.pathname, location.search);
  }, [navigate, location.pathname, location.search]);

  return (
    <div className="trip-sheet" data-testid="trip-sheet">
      <style>{SCOPED_STYLES}</style>
      <div className="trip-sheet-header">
        <button
          type="button"
          className="trip-sheet-close"
          onClick={handleClose}
          aria-label="關閉 sheet"
          data-testid="trip-sheet-close"
        >
          ✕
        </button>
        <TripSheetTabs currentTab={currentTab} onChange={handleTabChange} />
      </div>
      <div className="trip-sheet-body">
        {currentTab === 'map' && (
          <Suspense fallback={null}>
            <TripMapRail
              key={tripId}
              pins={allPins}
              tripId={tripId}
              pinsByDay={pinsByDay}
              dark={dark}
            />
          </Suspense>
        )}
        {currentTab === 'itinerary' && (
          <div className="trip-sheet-placeholder" data-testid="tab-itinerary">
            <div className="eyebrow">Itinerary</div>
            <h3>行程已顯示在左側</h3>
            <p>Timeline 在 main 區已展開，未來會搬到這個 tab（Mindtrip 3-pane 模式）。</p>
          </div>
        )}
        {currentTab === 'ideas' && (
          <div className="trip-sheet-placeholder" data-testid="tab-ideas">
            <div className="eyebrow">Coming soon · Phase 4</div>
            <h3>Ideas layer</h3>
            <p>POI 儲存池 + drag 進行程。實作在 B-P4 Explore + B-P5 Drag。</p>
          </div>
        )}
        {currentTab === 'chat' && (
          <div className="trip-sheet-placeholder" data-testid="tab-chat">
            <div className="eyebrow">Coming soon · Phase 3</div>
            <h3>Per-trip chat</h3>
            <p>針對這趟 trip 的 AI 對話。實作在 Workstream V2。</p>
          </div>
        )}
      </div>
    </div>
  );
}
