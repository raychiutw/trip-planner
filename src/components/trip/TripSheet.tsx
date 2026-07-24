/**
 * TripSheet — URL-driven right sheet for /trip/:id route.
 *
 * Reads `?sheet=itinerary|ideas|map|chat` and renders the matching tab content.
 * Default tab is `map` (matches B-P2 transitional behavior where sheet slot
 * held TripMapRail directly).
 */
import { Suspense, useCallback, useMemo } from 'react';
import { lazyWithRetry } from '../../lib/lazyWithRetry';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  parseSheetParam,
  setSheetParam,
  closeSheet,
  sheetPanelId,
  sheetTabId,
  type SheetTab,
} from '../../lib/trip-url';
import TripSheetTabs from './TripSheetTabs';
import Icon from '../shared/Icon';
import type { MapPin } from '../../hooks/useMapData';

const TripMapRail = lazyWithRetry(() => import('./TripMapRail'));
// v2.31.86：chat tab 從 placeholder「即將推出」改 embed ChatPage（embedded + lockTripId props）。
const ChatPage = lazyWithRetry(() => import('../../pages/ChatPage'));
// Ideas tab retired — V2 cutover (migration 0046) 把備案合一進「我的收藏」。

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
  /* owner 2026-07-22 回報「第三欄 header 沒對齊」：這條（地圖 / 聊天 tab）先前靠
   * padding 撐高，與中欄 TitleBar 的 --titlebar-h（64px 桌機 / 56px compact）不等高。
   * #1105 已把 .tp-stack-head 改吃同一個 token，但漏了這個右欄 header —— 三欄要對齊
   * 就得三個 header 都同源。safe-area-inset-top 比照 .tp-titlebar / .tp-stack-head。 */
  height: calc(var(--titlebar-h) + env(safe-area-inset-top, 0px));
  padding: env(safe-area-inset-top, 0px) 16px 0;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.trip-sheet-close {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-muted);
  display: grid; place-items: center; cursor: pointer;
  font: inherit; font-size: var(--font-size-footnote);
}
.trip-sheet-close:hover { border-color: var(--color-accent); color: var(--color-accent); }
/* v2.31.81 #4：桌機 ≥1024px sheet 是 always-on 右側 column（3-pane layout 由
 * AppShell 控），X 點下去 URL 改 closeSheet 但 sheet 仍 mount → user 看到「X 沒用」。
 * 桌機 hide X — sheet 切換靠 tab header (.trip-sheet-tabs)，不需 close。
 * Mobile <1024px X 仍保留（mobile sheet 是 slide-up overlay，X dismiss 合理）。 */
@media (min-width: 1024px) {
  .trip-sheet-close { display: none; }
}
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

/* v2.31.48 fix：HTML hidden attr 預設 display: none，但
 * .trip-sheet-placeholder display:flex (specificity 0,1,0) 覆蓋
 * [hidden] (UA stylesheet specificity 0,0,1) → itinerary + chat
 * placeholder 即使非 active 也 visible，疊在 map tab 上下。
 * Selector specificity (0,2,0) 強制 hidden tabpanel 不顯示。
 *
 * v2.31.49 follow-up：map tab 沒 className 也沒 flex:1，hidden 兄弟一
 * display:none 後就 collapse 4px（trip-sheet-body 是 flex column，active
 * map panel 沒 flex 屬性 → height 0）。給 active tabpanel 強制 flex:1 +
 * min-height:0，讓 TripMapRail 100% height 規則拿得到實際高度。
 *
 * v2.31.54 simplify follow-up：scope to .trip-sheet-body — 之前 selector 是
 * 全 document 範圍，會影響任何其他 page 的 [role="tabpanel"]。Scope 後只
 * 影響 TripSheet 內的 tabpanel。 */
.trip-sheet-body [role="tabpanel"][hidden] { display: none; }
.trip-sheet-body [role="tabpanel"]:not([hidden]) { flex: 1; min-height: 0; }

/* TripMapRail 預設 .trip-map-rail 是給 main column scroll context 用：
   position:sticky + height:calc(100dvh - var(--spacing-nav-h))。
   放進 sheet 後 sticky 失效，且 100dvh 不等於 sheet 可用高度 → map 視覺只佔約 1/4。
   用 specificity (0,2,0) 覆蓋 + 撐滿 sheet body。
   position 用 relative（非 static）：in-flow layout 與 static 等同（無 top/left 位移），但**建立
   定位包含塊**，讓 Google POI 卡（.trip-map-rail-poi-card，absolute）依 rail 置中，而非逃逸到
   viewport 中央（grill item 2/3；owner「浮在地圖底部中央」）。 */
.trip-sheet-body .trip-map-rail {
  position: relative;
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
          <Icon name="x-mark" />
        </button>
        <TripSheetTabs currentTab={currentTab} onChange={handleTabChange} />
      </div>
      <div className="trip-sheet-body">
        {/* ARIA tabs pattern: 2 個 tabpanel 都 in DOM 用 hidden 切換，
            這樣每個 tab 的 aria-controls 永遠 resolve 到實際 element。
            map tab 內仍 conditional mount 維持 lazy + key={tripId} 重 init 行為。
            v2.31.85：itinerary tab 拿掉（main column 已 render 行程，sheet 重複無價值）。 */}
        <div
          role="tabpanel"
          id={sheetPanelId('map')}
          aria-labelledby={sheetTabId('map')}
          hidden={currentTab !== 'map'}
        >
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
        </div>
        <div
          role="tabpanel"
          id={sheetPanelId('chat')}
          aria-labelledby={sheetTabId('chat')}
          hidden={currentTab !== 'chat'}
          data-testid="tab-chat"
        >
          {/* v2.31.86：chat tab embed ChatPage（embedded mode skip AppShell + TitleBar，
              lockTripId 鎖 active trip 到當前 TripPage trip context）。 */}
          {currentTab === 'chat' && (
            <Suspense fallback={null}>
              <ChatPage embedded lockTripId={tripId} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
