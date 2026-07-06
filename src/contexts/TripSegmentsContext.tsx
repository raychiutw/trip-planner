/**
 * TripSegmentsContext — share useTripSegments fetch across all DaySection /
 * TimelineRail instances on TripPage。
 *
 * v2.31.x N+1 fix：原本每個 TimelineRail 自己 call useTripSegments(tripId)，
 * 5 day trip = 5 個 GET /api/trips/:id/segments 平行打。Hoist 到 TripPage
 * 一次 fetch，children 從 context 讀同一份 segmentMap。
 *
 * Fallback: TimelineRail 在 context 未提供時退回自己 fetch（EditEntryPage
 * 等獨立頁面不在 TripPage tree）。Provider 用 null sentinel 表示「未提供」，
 * 讓 hook 內部走原本 hook fetch path。
 */
import { createContext } from 'react';
import type { TripSegment } from '../hooks/useTripSegments';

export interface TripSegmentsContextValue {
  segments: TripSegment[];
  segmentMap: Map<string, TripSegment>;
  loading: boolean;
  /** 首次 fetch 是否已 settle — self-healing 補算必須等 ready 才能判斷缺 pair。 */
  ready: boolean;
}

export const TripSegmentsContext = createContext<TripSegmentsContextValue | null>(null);
