/**
 * TimelineEvent — type-only module（PR2 v2.7 之後）
 *
 * 之前是 4-col 「tp-stop」 stop card component，但 Timeline.tsx 早已只 render
 * TimelineRail，TimelineEvent component 是 orphan。PR2 把 V3 inline expansion
 * 行為 port 到 TimelineRail（實際 render path），這裡只保留 5 個檔案還在用的
 * `TimelineEntryData` / `TravelData` 兩個 type。
 *
 * Type imports（不要破）：
 *   - components/trip/Timeline.tsx
 *   - components/trip/TimelineRail.tsx
 *   - components/trip/TodayRouteSheet.tsx
 *   - lib/timelineUtils.ts
 *   - lib/mapDay.ts
 */

// v2.33.37 round 2: types canonical 已移到 src/types/timeline.ts。
// 本檔 re-export 維持向後相容（5 個 consumer 還 import from this file）。
export type {
  TravelData,
  StopPoiOptionData,
  TimelineEntryData,
} from '../../types/timeline';
