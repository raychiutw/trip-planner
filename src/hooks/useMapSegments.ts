/**
 * useMapSegments — derive SegmentPair[] for polyline rendering.
 *
 * v2.33.57 round 11: extracted from `src/components/trip/OceanMap.tsx`
 * line 343-347 as part of the 4-module split. Memo dep array preserved.
 *
 * Returns [] when showRoutes=false. <Segment> render itself stays in
 * OceanMap.tsx (JSX 沒抽出來)。
 */
import { useMemo } from 'react';
import { buildSegments, type SegmentPair } from '../lib/mapHelpers';
import type { MapPin } from '../lib/mapTypes';

export interface UseMapSegmentsParams {
  pins: MapPin[];
  pinsByDay?: Map<number, MapPin[]>;
  showRoutes: boolean;
  focusedIdx: number;
  pinIndexById: Map<number, number>;
  dayNum?: number;
}

export function useMapSegments(params: UseMapSegmentsParams): SegmentPair[] {
  const { pins, pinsByDay, showRoutes, focusedIdx, pinIndexById, dayNum } = params;

  return useMemo(() => {
    if (!showRoutes) return [];
    return buildSegments({ pins, pinsByDay, focusedIdx, pinIndexById, dayNum });
  }, [pins, showRoutes, focusedIdx, pinsByDay, pinIndexById, dayNum]);
}
