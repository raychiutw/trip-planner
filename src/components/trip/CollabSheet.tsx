/**
 * CollabSheet — v2.18.0 後改為 CollabPanel 的薄 shim。
 *
 * v2.17 起本 component 是獨立 sheet body 渲染整段 collab UI;v2.18.0 起 collab
 * 升格 `/trip/:tripId/collab` 獨立頁面,主要 entry point 都 navigate 過去。
 * 但既有 InfoSheet 在 TripPage 內仍可能渲染本 component(legacy `?sheet=collab`
 * deeplink 已 redirect,但 TripSheetContent 的 case 'collab' dispatch 也走這裡)。
 *
 * 為了避免 design drift(舊 sheet 內 vs 新 page 內顯示不同 UI),本 component
 * 改成 wrapper:直接渲染 CollabPanel。將來 InfoSheet wrapper 整批拔掉時可一併刪。
 */
import CollabPanel from './CollabPanel';

interface CollabSheetProps {
  tripId: string;
}

export default function CollabSheet({ tripId }: CollabSheetProps) {
  return <CollabPanel tripId={tripId} />;
}
